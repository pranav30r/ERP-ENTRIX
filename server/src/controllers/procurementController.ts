import { Request, Response } from 'express';
import crypto from 'crypto';
import {
  PurchaseRequest,
  InventoryItem,
  User,
  Department,
  PurchaseOrder,
  GoodsReceivedNote,
  LedgerEntry,
  Supplier,
  SupplierInvoice,
  InventoryMovement
} from '../models';
import { sequelize } from '../config/db';
import { AuditService } from '../services/auditService';

export const createPurchaseRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { item_id, quantity, justification } = req.body;

    if (!item_id || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'Valid item_id and quantity (>0) are required.' });
      return;
    }

    // Verify item belongs to active tenant
    const item = await InventoryItem.findOne({
      where: { id: item_id, tenant_id: tenantId }
    });

    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item SKU not found in your company catalog.' });
      return;
    }

    const estimated_total = Number(item.unit_price) * Number(quantity);
    const pr_code = `PR-2026-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    let targetDeptId = authUser?.department_id;
    if (!targetDeptId) {
      const defaultDept = await Department.findOne({ where: { tenant_id: tenantId } });
      targetDeptId = defaultDept ? defaultDept.id : '11111111-1111-1111-1111-111111111111';
    }

    const pr = await PurchaseRequest.create({
      tenant_id: tenantId,
      pr_code,
      requester_id: authUser ? authUser.id : null,
      department_id: targetDeptId,
      item_id,
      quantity,
      estimated_total,
      status: 'PENDING_MANAGER',
      justification: justification || 'Operational replenishment'
    });

    if ((req as any).io) {
      (req as any).io.to(`tenant:${tenantId}`).emit('pr_created', { pr, message: `New Requisition ${pr_code} submitted.` });
    }

    res.status(201).json({
      success: true,
      data: pr,
      requires_finance_approval: estimated_total >= 10000
    });
  } catch (error) {
    console.error('Create PR error:', error);
    res.status(500).json({ success: false, error: 'Error creating purchase request.' });
  }
};

export const getPurchaseRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId && authUser?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const whereClause: any = {};

    // Tenant Scoping
    if (tenantId) {
      whereClause.tenant_id = tenantId;
    }

    // Department / User Scoping: standard staff users only see their own requests
    if (authUser && authUser.role_name === 'STAFF_USER') {
      whereClause.requester_id = authUser.id;
    }

    const requests = await PurchaseRequest.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
        { model: InventoryItem, as: 'item' },
        {
          model: PurchaseOrder,
          as: 'purchase_order',
          include: [{ model: GoodsReceivedNote, as: 'grns' }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving purchase requests.' });
  }
};

export const managerApproval = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { id } = req.params;
    const { action, comments } = req.body; // 'APPROVE' | 'REJECT'

    const pr = await PurchaseRequest.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!pr) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Purchase request not found.' });
      return;
    }

    // Tenant Isolation
    if (!tenantId || (pr.tenant_id !== tenantId && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Access denied: Cannot approve requisitions belonging to another company.' });
      return;
    }

    // Department Isolation: Department leads cannot approve requisitions outside their department
    if (authUser && authUser.role_name === 'HR_MANAGER' && authUser.department_id && pr.department_id !== authUser.department_id) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Access denied: Department isolation policy restricts approval to own department requisitions.' });
      return;
    }

    if (pr.status !== 'PENDING_MANAGER') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: `Invalid transition: Current status is ${pr.status}` });
      return;
    }

    if (action === 'REJECT') {
      pr.status = 'REJECTED';
      pr.rejection_reason = comments || 'Rejected by Department Manager';
      await pr.save({ transaction });

      await AuditService.logMutation(
        authUser ? authUser.id : null,
        'MANAGER_REJECT_PR',
        'purchase_requests',
        pr.id,
        { previous_status: 'PENDING_MANAGER', new_status: 'REJECTED', comments: pr.rejection_reason },
        transaction,
        pr.tenant_id
      );

      await transaction.commit();

      if ((req as any).io) {
        (req as any).io.to(`tenant:${pr.tenant_id}`).emit('pr_status_changed', { pr, stage: 'REJECTED', message: `Requisition ${pr.pr_code} was rejected.` });
      }

      res.status(200).json({ success: true, message: 'Request rejected', data: pr });
      return;
    }

    // Branching Rule: < ₹10,000 auto-advances to APPROVED; >= ₹10,000 requires FINANCE sign-off
    const nextStatus = Number(pr.estimated_total) < 10000 ? 'APPROVED' : 'PENDING_FINANCE';
    pr.status = nextStatus;
    await pr.save({ transaction });

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'MANAGER_APPROVE_PR',
      'purchase_requests',
      pr.id,
      { previous_status: 'PENDING_MANAGER', new_status: nextStatus, comments },
      transaction,
      pr.tenant_id
    );

    await transaction.commit();

    if ((req as any).io) {
      (req as any).io.to(`tenant:${pr.tenant_id}`).emit('pr_status_changed', { pr, stage: nextStatus, message: `Requisition ${pr.pr_code} moved to ${nextStatus}.` });
    }

    res.status(200).json({
      success: true,
      message: nextStatus === 'APPROVED' ? 'Approved directly (Under ₹10k threshold)' : 'Advanced to Finance Approval',
      data: pr
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error processing manager approval. Transaction rolled back.' });
  }
};

export const financeApproval = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { id } = req.params;
    const { action, comments } = req.body;

    const pr = await PurchaseRequest.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!pr) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Purchase request not found.' });
      return;
    }

    // Tenant Isolation
    if (!tenantId || (pr.tenant_id !== tenantId && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Access denied: Cannot sign-off requisitions belonging to another company.' });
      return;
    }

    if (pr.status !== 'PENDING_FINANCE') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: `Invalid transition: Current status is ${pr.status}` });
      return;
    }

    if (action === 'REJECT') {
      pr.status = 'REJECTED';
      pr.rejection_reason = comments || 'Rejected by Finance Officer';
      await pr.save({ transaction });

      await AuditService.logMutation(
        authUser ? authUser.id : null,
        'FINANCE_REJECT_PR',
        'purchase_requests',
        pr.id,
        { previous_status: 'PENDING_FINANCE', new_status: 'REJECTED', comments: pr.rejection_reason },
        transaction,
        pr.tenant_id
      );

      await transaction.commit();
      res.status(200).json({ success: true, message: 'Request rejected by Finance', data: pr });
      return;
    }

    pr.status = 'APPROVED';
    await pr.save({ transaction });

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'FINANCE_APPROVE_PR',
      'purchase_requests',
      pr.id,
      { previous_status: 'PENDING_FINANCE', new_status: 'APPROVED', comments },
      transaction,
      pr.tenant_id
    );

    await transaction.commit();

    if ((req as any).io) {
      (req as any).io.to(`tenant:${pr.tenant_id}`).emit('pr_status_changed', { pr, stage: 'APPROVED', message: `Requisition ${pr.pr_code} approved by Finance.` });
    }

    res.status(200).json({ success: true, message: 'Finance sign-off complete. Approved.', data: pr });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error processing finance approval. Transaction rolled back.' });
  }
};

export const receiveGoods = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { id } = req.params;

    const pr = await PurchaseRequest.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!pr) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Purchase request not found.' });
      return;
    }

    // Tenant Isolation
    if (!tenantId || (pr.tenant_id !== tenantId && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Access denied: Cannot receive goods for another company.' });
      return;
    }

    if (pr.status !== 'APPROVED' && pr.status !== 'PO_ISSUED') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: `Cannot receive goods. Status is ${pr.status}` });
      return;
    }

    const item = await InventoryItem.findByPk(pr.item_id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!item) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Inventory item referenced by PR not found.' });
      return;
    }

    // Atomic Inventory Stock Increment
    const prevStock = Number(item.stock_qty);
    const newStock = prevStock + Number(pr.quantity);
    item.stock_qty = newStock;
    await item.save({ transaction });

    // Transition PR state
    pr.status = 'GOODS_RECEIVED';
    await pr.save({ transaction });

    // Ensure linked Purchase Order exists with tenant_id
    let po = await PurchaseOrder.findOne({ where: { pr_id: pr.id }, transaction });
    if (!po) {
      po = await PurchaseOrder.create(
        {
          tenant_id: pr.tenant_id,
          po_number: `PO-2026-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`,
          pr_id: pr.id,
          vendor_name: 'Apex Industrial Supplies Ltd',
          ordered_quantity: pr.quantity,
          total_amount: pr.estimated_total
        },
        { transaction }
      );
    }

    // Create Goods Received Note (GRN) with tenant_id
    const grn = await GoodsReceivedNote.create(
      {
        tenant_id: pr.tenant_id,
        grn_code: `GRN-2026-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`,
        po_id: po.id,
        received_quantity: pr.quantity,
        verified_by: authUser ? authUser.id : pr.requester_id
      },
      { transaction }
    );

    // Record immutable stock movement in inventory ledger
    await InventoryMovement.create(
      {
        tenant_id: pr.tenant_id,
        item_id: item.id,
        movement_type: 'IN',
        quantity: pr.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        reference_type: 'GRN_RECEIPT',
        reference_id: grn.id,
        notes: `Procurement fulfillment for ${pr.pr_code} via ${grn.grn_code}`
      },
      { transaction }
    );

    // Post balanced double-entry General Ledger transaction with tenant_id:
    // Debit Raw Material Inventory (Asset), Credit GR/IR Clearing Suspense (Goods Received Not Invoiced)
    const txUuid = crypto.randomUUID();
    await LedgerEntry.bulkCreate(
      [
        {
          tenant_id: pr.tenant_id,
          transaction_uuid: txUuid,
          account_code: '1510 - Raw Material Inventory',
          debit_amount: pr.estimated_total,
          credit_amount: 0.00,
          reference_type: 'GRN_RECEIPT',
          reference_id: grn.id
        },
        {
          tenant_id: pr.tenant_id,
          transaction_uuid: txUuid,
          account_code: '2015 - GR/IR Clearing Suspense',
          debit_amount: 0.00,
          credit_amount: pr.estimated_total,
          reference_type: 'GRN_RECEIPT',
          reference_id: grn.id
        }
      ],
      { transaction }
    );

    // Cryptographic audit log linking all artifacts with tenant_id
    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'GOODS_RECEIVED_GRN',
      'purchase_requests',
      pr.id,
      {
        pr_code: pr.pr_code,
        quantity: pr.quantity,
        grn_code: grn.grn_code,
        po_number: po.po_number,
        stock_before: prevStock,
        stock_after: item.stock_qty
      },
      transaction,
      pr.tenant_id
    );

    await transaction.commit();

    if ((req as any).io) {
      (req as any).io.to(`tenant:${pr.tenant_id}`).emit('grn_received', { pr, message: `Goods received & stock incremented for ${pr.pr_code}.` });
    }

    res.status(200).json({
      success: true,
      message: `Goods received: Added ${pr.quantity} units to inventory SKU ${item.sku_code}.`,
      data: {
        pr,
        updated_stock: item.stock_qty,
        grn,
        po
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Transaction rolled back. Error receiving goods.' });
  }
};

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId && authUser?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const whereClause: any = {};
    if (tenantId) whereClause.tenant_id = tenantId;

    let suppliers = await Supplier.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    // Seed initial vendor if none exists for primary default tenant
    if (suppliers.length === 0 && tenantId === '00000000-0000-0000-0000-000000000001') {
      await Supplier.create({
        tenant_id: '00000000-0000-0000-0000-000000000001',
        code: 'SUP-APEX-01',
        name: 'Apex Industrial Supplies Ltd',
        email: 'sales@apexsupplies.local',
        phone: '+91 98200 12345',
        payment_terms: 'NET30',
        rating: 4.8
      });
      suppliers = await Supplier.findAll({ where: whereClause });
    }

    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching suppliers.' });
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { code, name, email, phone, payment_terms = 'NET30', rating = 5.0 } = req.body;

    if (!code || !name) {
      res.status(400).json({ success: false, error: 'Supplier code and name are required.' });
      return;
    }

    const existing = await Supplier.findOne({ where: { tenant_id: tenantId, code: String(code).trim().toUpperCase() } });
    if (existing) {
      res.status(409).json({ success: false, error: `Supplier code '${code}' already exists.` });
      return;
    }

    const supplier = await Supplier.create({
      tenant_id: tenantId,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      email: email ? String(email).trim() : null,
      phone: phone ? String(phone).trim() : null,
      payment_terms,
      rating: Number(rating) || 5.0
    });

    res.status(201).json({ success: true, data: supplier, message: 'Supplier registered successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creating supplier record.' });
  }
};

export const selectSupplier = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { id } = req.params;
    const { supplier_id } = req.body;

    if (!supplier_id) {
      await transaction.rollback();
      res.status(400).json({ success: false, error: 'supplier_id is required.' });
      return;
    }

    const pr = await PurchaseRequest.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!pr) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Purchase request not found.' });
      return;
    }

    if (!tenantId || (pr.tenant_id !== tenantId && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Access denied: Cannot mutate requisitions of another tenant.' });
      return;
    }

    if (pr.status !== 'APPROVED') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: `Cannot select supplier: PR is in '${pr.status}' state (must be APPROVED).` });
      return;
    }

    const supplier = await Supplier.findByPk(supplier_id, { transaction });
    if (!supplier) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Supplier not found.' });
      return;
    }

    // Issue Purchase Order with selected supplier
    let po = await PurchaseOrder.findOne({ where: { pr_id: pr.id }, transaction });
    if (!po) {
      po = await PurchaseOrder.create({
        tenant_id: pr.tenant_id,
        po_number: `PO-2026-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`,
        pr_id: pr.id,
        vendor_name: supplier.name,
        ordered_quantity: pr.quantity,
        total_amount: pr.estimated_total
      }, { transaction });
    } else {
      po.vendor_name = supplier.name;
      await po.save({ transaction });
    }

    pr.status = 'PO_ISSUED';
    await pr.save({ transaction });

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'SUPPLIER_SELECTED_PO_ISSUED',
      'purchase_requests',
      pr.id,
      { supplier_id: supplier.id, supplier_name: supplier.name, po_number: po.po_number },
      transaction,
      pr.tenant_id
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Supplier '${supplier.name}' assigned. Purchase Order ${po.po_number} issued.`,
      data: { pr, po, supplier }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error selecting supplier. Transaction rolled back.' });
  }
};

export const matchSupplierInvoice = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { invoice_number, po_id, grn_id, billed_quantity, invoice_amount, supplier_id } = req.body;

    if (!invoice_number || !po_id || !grn_id || billed_quantity === undefined || invoice_amount === undefined) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: 'invoice_number, po_id, grn_id, billed_quantity, and invoice_amount are required.'
      });
      return;
    }

    const po = await PurchaseOrder.findByPk(po_id, { transaction });
    if (!po) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Purchase Order not found.' });
      return;
    }

    const grn = await GoodsReceivedNote.findByPk(grn_id, { transaction });
    if (!grn) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Goods Received Note not found.' });
      return;
    }

    if (grn.po_id !== po.id) {
      await transaction.rollback();
      res.status(400).json({ success: false, error: 'GRN does not correspond to the specified Purchase Order.' });
      return;
    }

    if (!tenantId || ((po.tenant_id !== tenantId || grn.tenant_id !== tenantId) && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Cross-tenant access forbidden.' });
      return;
    }

    const pr = await PurchaseRequest.findByPk(po.pr_id, { transaction, lock: transaction.LOCK.UPDATE });

    // 3-Way Match Verification:
    // 1. Quantity match: Billed Quantity vs Received Quantity
    // 2. Value match: Billed Amount vs PO Amount (with 1.0% discrepancy tolerance)
    const qtyMismatch = Number(billed_quantity) !== Number(grn.received_quantity);
    const amountDifference = Math.abs(Number(invoice_amount) - Number(po.total_amount));
    const allowedTolerance = Number(po.total_amount) * 0.01; // 1%
    const priceDivergence = amountDifference > allowedTolerance;

    let matchStatus: 'MATCHED' | 'DISCREPANCY' = 'MATCHED';
    let discrepancyNotes = '';

    if (qtyMismatch) {
      matchStatus = 'DISCREPANCY';
      discrepancyNotes += `Quantity mismatch: Billed ${billed_quantity} units vs Received ${grn.received_quantity} units. `;
    }
    if (priceDivergence) {
      matchStatus = 'DISCREPANCY';
      discrepancyNotes += `Price mismatch: Invoiced ₹${Number(invoice_amount).toFixed(2)} vs Ordered ₹${Number(po.total_amount).toFixed(2)} (Variance exceeds 1% tolerance).`;
    }

    const invoice = await SupplierInvoice.create({
      tenant_id: po.tenant_id,
      invoice_number: String(invoice_number).trim(),
      supplier_id: supplier_id || null,
      po_id: po.id,
      grn_id: grn.id,
      billed_quantity: Number(billed_quantity),
      invoice_amount: Number(invoice_amount),
      status: matchStatus,
      discrepancy_notes: discrepancyNotes || null,
      matched_at: matchStatus === 'MATCHED' ? new Date() : null
    }, { transaction });

    if (matchStatus === 'MATCHED' && pr) {
      pr.status = 'INVOICE_MATCHED';
      await pr.save({ transaction });

      // Post verified supplier invoice recognition to General Ledger:
      // Debit GR/IR Clearing Suspense (extinguishes provisional accrual)
      // Credit Accounts Payable (recognizes binding vendor liability)
      const txUuid = crypto.randomUUID();
      await LedgerEntry.bulkCreate([
        {
          tenant_id: po.tenant_id,
          transaction_uuid: txUuid,
          account_code: '2015 - GR/IR Clearing Suspense',
          debit_amount: invoice.invoice_amount,
          credit_amount: 0.00,
          reference_type: 'INVOICE_RECOGNITION',
          reference_id: invoice.id
        },
        {
          tenant_id: po.tenant_id,
          transaction_uuid: txUuid,
          account_code: '2010 - Accounts Payable',
          debit_amount: 0.00,
          credit_amount: invoice.invoice_amount,
          reference_type: 'INVOICE_RECOGNITION',
          reference_id: invoice.id
        }
      ], { transaction });
    }

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      matchStatus === 'MATCHED' ? '3WAY_INVOICE_MATCH_SUCCESS' : '3WAY_INVOICE_DISCREPANCY',
      'supplier_invoices',
      invoice.id,
      {
        invoice_number: invoice.invoice_number,
        match_status: matchStatus,
        discrepancy_notes: discrepancyNotes,
        billed_amount: invoice.invoice_amount,
        po_amount: po.total_amount
      },
      transaction,
      po.tenant_id
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      match_status: matchStatus,
      data: invoice,
      discrepancies: discrepancyNotes || null,
      message: matchStatus === 'MATCHED'
        ? 'Three-way match confirmed. Supplier liability recognized in Accounts Payable.'
        : `Discrepancy detected: ${discrepancyNotes}`
    });
  } catch (error: any) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: error?.message || 'Error processing 3-way invoice match.' });
  }
};

export const settleSupplierInvoice = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }

    const { id } = req.params;
    const invoice = await SupplierInvoice.findOne({
      where: { id, tenant_id: tenantId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!invoice) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Supplier invoice not found.' });
      return;
    }

    if (invoice.status === 'PAID') {
      await transaction.rollback();
      res.status(409).json({ success: false, error: 'Invoice has already been settled and paid.' });
      return;
    }

    if (invoice.status !== 'MATCHED') {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: `Cannot settle invoice: Current status is '${invoice.status}'. Invoice must be in 'MATCHED' status.`
      });
      return;
    }

    // Post Payment Settlement:
    // Debit Accounts Payable (clears liability), Credit Operating Cash (outflow)
    const txUuid = crypto.randomUUID();
    await LedgerEntry.bulkCreate([
      {
        tenant_id: tenantId,
        transaction_uuid: txUuid,
        account_code: '2010 - Accounts Payable',
        debit_amount: invoice.invoice_amount,
        credit_amount: 0.00,
        reference_type: 'PAYMENT_SETTLEMENT',
        reference_id: invoice.id
      },
      {
        tenant_id: tenantId,
        transaction_uuid: txUuid,
        account_code: '1010 - Operating Cash',
        debit_amount: 0.00,
        credit_amount: invoice.invoice_amount,
        reference_type: 'PAYMENT_SETTLEMENT',
        reference_id: invoice.id
      }
    ], { transaction });

    invoice.status = 'PAID';
    await invoice.save({ transaction });

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'SUPPLIER_INVOICE_PAID',
      'supplier_invoices',
      invoice.id,
      {
        invoice_number: invoice.invoice_number,
        amount_paid: invoice.invoice_amount,
        status: 'PAID',
        transaction_uuid: txUuid
      },
      transaction,
      tenantId
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Invoice ${invoice.invoice_number} settled successfully. Accounts payable cleared against Operating Cash.`,
      data: invoice
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error processing supplier payment settlement.' });
  }
};

export const getSupplierInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required.' });
      return;
    }

    const invoices = await SupplierInvoice.findAll({
      where: { tenant_id: tenantId },
      include: [
        { model: PurchaseOrder, as: 'purchase_order' },
        { model: GoodsReceivedNote, as: 'grn' }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('[ProcurementController] getSupplierInvoices error:', error);
    res.status(500).json({ success: false, error: 'Error fetching supplier invoices.' });
  }
};

export const getPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required.' });
      return;
    }

    const orders = await PurchaseOrder.findAll({
      where: { tenant_id: tenantId },
      include: [
        { model: GoodsReceivedNote, as: 'grns' },
        { model: PurchaseRequest, as: 'purchase_request', include: [{ model: InventoryItem, as: 'item' }] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('[ProcurementController] getPurchaseOrders error:', error);
    res.status(500).json({ success: false, error: 'Error fetching purchase orders.' });
  }
};


