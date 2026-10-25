import { Request, Response } from 'express';
import { PurchaseRequest, InventoryItem, User, Department } from '../models';
import { sequelize } from '../config/db';

export const createPurchaseRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { item_id, quantity, justification } = req.body;

    if (!item_id || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'Valid item_id and quantity (>0) are required.' });
      return;
    }

    const item = await InventoryItem.findByPk(item_id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item SKU not found.' });
      return;
    }

    const estimated_total = Number(item.unit_price) * Number(quantity);
    const pr_code = `PR-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    const pr = await PurchaseRequest.create({
      pr_code,
      requester_id: authUser.id,
      department_id: authUser.department_id || '11111111-1111-1111-1111-111111111111',
      item_id,
      quantity,
      estimated_total,
      status: 'PENDING_MANAGER',
      justification: justification || 'Operational replenishment'
    });

    if ((req as any).io) {
      (req as any).io.emit('pr_created', { pr, message: `New Requisition ${pr_code} submitted.` });
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
    const requests = await PurchaseRequest.findAll({
      include: [
        { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
        { model: InventoryItem, as: 'item' }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving purchase requests.' });
  }
};

export const managerApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body; // 'APPROVE' | 'REJECT'

    const pr = await PurchaseRequest.findByPk(id);
    if (!pr) {
      res.status(404).json({ success: false, error: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== 'PENDING_MANAGER') {
      res.status(400).json({ success: false, error: `Invalid transition: Current status is ${pr.status}` });
      return;
    }

    if (action === 'REJECT') {
      pr.status = 'REJECTED';
      pr.rejection_reason = comments || 'Rejected by Department Manager';
      await pr.save();
      res.status(200).json({ success: true, message: 'Request rejected', data: pr });
      return;
    }

    // Branching Rule: < ₹10,000 auto-advances to APPROVED; >= ₹10,000 requires FINANCE sign-off
    const nextStatus = Number(pr.estimated_total) < 10000 ? 'APPROVED' : 'PENDING_FINANCE';
    pr.status = nextStatus;
    await pr.save();

    if ((req as any).io) {
      (req as any).io.emit('pr_status_changed', { pr, stage: nextStatus, message: `Requisition ${pr.pr_code} moved to ${nextStatus}.` });
    }

    res.status(200).json({
      success: true,
      message: nextStatus === 'APPROVED' ? 'Approved directly (Under ₹10k threshold)' : 'Advanced to Finance Approval',
      data: pr
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error processing manager approval.' });
  }
};

export const financeApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;

    const pr = await PurchaseRequest.findByPk(id);
    if (!pr) {
      res.status(404).json({ success: false, error: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== 'PENDING_FINANCE') {
      res.status(400).json({ success: false, error: `Invalid transition: Current status is ${pr.status}` });
      return;
    }

    if (action === 'REJECT') {
      pr.status = 'REJECTED';
      pr.rejection_reason = comments || 'Rejected by Finance Officer';
      await pr.save();
      res.status(200).json({ success: true, message: 'Request rejected by Finance', data: pr });
      return;
    }

    pr.status = 'APPROVED';
    await pr.save();

    if ((req as any).io) {
      (req as any).io.emit('pr_status_changed', { pr, stage: 'APPROVED', message: `Requisition ${pr.pr_code} approved by Finance.` });
    }

    res.status(200).json({ success: true, message: 'Finance sign-off complete. Approved.', data: pr });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error processing finance approval.' });
  }
};

export const receiveGoods = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const pr = await PurchaseRequest.findByPk(id, { transaction });
    if (!pr) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Purchase request not found.' });
      return;
    }

    if (pr.status !== 'APPROVED' && pr.status !== 'PO_ISSUED') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: `Cannot receive goods. Status is ${pr.status}` });
      return;
    }

    // Atomic Inventory Increment
    const item = await InventoryItem.findByPk(pr.item_id, { transaction });
    if (item) {
      item.stock_qty = Number(item.stock_qty) + Number(pr.quantity);
      await item.save({ transaction });
    }

    pr.status = 'GOODS_RECEIVED';
    await pr.save({ transaction });

    await transaction.commit();

    if ((req as any).io) {
      (req as any).io.emit('grn_received', { pr, message: `Goods received & stock incremented for ${pr.pr_code}.` });
    }

    res.status(200).json({
      success: true,
      message: `Goods received: Added ${pr.quantity} units to inventory SKU ${item?.sku_code}.`,
      data: {
        pr,
        updated_stock: item?.stock_qty
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Transaction rolled back. Error receiving goods.' });
  }
};
