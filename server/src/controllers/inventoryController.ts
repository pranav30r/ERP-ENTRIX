import { Request, Response } from 'express';
import { InventoryItem, InventoryMovement } from '../models';
import { AuditService } from '../services/auditService';
import { sequelize } from '../config/db';

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenant_id || (req as any).tenantId;
    if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const whereClause: any = {};
    if (tenantId) {
      whereClause.tenant_id = tenantId;
    }

    const items = await InventoryItem.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    const lowStockCount = items.filter((i) => i.stock_qty <= i.safety_stock).length;

    res.status(200).json({
      success: true,
      data: items,
      metrics: {
        total_items: items.length,
        low_stock_items: lowStockCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching inventory.' });
  }
};

export const createInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku_code, name, category, unit_of_measure, unit_price, stock_qty, safety_stock } = req.body;
    const tenantId = (req as any).user?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }

    // Unique per tenant
    const existing = await InventoryItem.findOne({ where: { sku_code, tenant_id: tenantId } });
    if (existing) {
      res.status(400).json({ success: false, error: `SKU code '${sku_code}' already exists in your company inventory.` });
      return;
    }

    const item = await InventoryItem.create({
      tenant_id: tenantId,
      sku_code,
      name,
      category,
      unit_of_measure: unit_of_measure || 'PCS',
      unit_price,
      stock_qty: stock_qty || 0,
      safety_stock: safety_stock || 10
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creating inventory item.' });
  }
};

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { quantity, type, reason } = req.body; // type: 'IN' | 'OUT'
    const user = (req as any).user;
    const tenantId = (req as any).user?.tenant_id || (req as any).tenantId;

    // Acquire row-level lock and verify tenant ownership
    const item = await InventoryItem.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!item) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Inventory item not found.' });
      return;
    }

    // Strict cross-tenant check
    if (!tenantId || (item.tenant_id !== tenantId && user?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Access denied: Cannot mutate inventory belonging to another tenant.' });
      return;
    }

    const previousQty = Number(item.stock_qty);
    const qtyChange = Number(quantity);
    if (isNaN(qtyChange) || qtyChange <= 0) {
      await transaction.rollback();
      res.status(400).json({ success: false, error: 'Valid positive quantity required.' });
      return;
    }

    if (type !== 'IN' && type !== 'OUT') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: "Adjustment type must be 'IN' or 'OUT'." });
      return;
    }

    if (type === 'OUT' && previousQty < qtyChange) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: `Insufficient stock: requested deduction of ${qtyChange} units, but available stock is only ${previousQty} units.`
      });
      return;
    }

    const newQty = type === 'IN' ? previousQty + qtyChange : previousQty - qtyChange;
    item.stock_qty = newQty;
    await item.save({ transaction });

    // Record auditable inventory movement ledger entry
    await InventoryMovement.create(
      {
        tenant_id: item.tenant_id,
        item_id: item.id,
        movement_type: type === 'IN' ? 'IN' : 'OUT',
        quantity: qtyChange,
        previous_stock: previousQty,
        new_stock: newQty,
        reference_type: 'STOCK_ADJUSTMENT',
        notes: reason || `Manual adjustment by ${user?.email || 'Authorized User'}`
      },
      { transaction }
    );

    // Atomically link cryptographic audit log to same transaction
    await AuditService.logMutation(
      user ? user.id : null,
      `STOCK_${type}_ADJUSTMENT`,
      'inventory_items',
      item.id,
      { previous_qty: previousQty, new_qty: newQty, reason: reason || 'Manual adjustment' },
      transaction,
      item.tenant_id
    );

    await transaction.commit();

    // Tenant-isolated Socket.io broadcast
    if ((req as any).io) {
      (req as any).io.to(`tenant:${item.tenant_id}`).emit('inventory_updated', item);
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error adjusting stock level. Transaction rolled back.' });
  }
};

export const getInventoryMovements = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenant_id || (req as any).tenantId;
    if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { id } = req.params;
    const whereClause: any = {};
    if (tenantId) whereClause.tenant_id = tenantId;
    if (id) whereClause.item_id = id;

    const movements = await InventoryMovement.findAll({
      where: whereClause,
      include: [{ model: InventoryItem, as: 'item', attributes: ['id', 'sku_code', 'name', 'unit_of_measure'] }],
      order: [['created_at', 'DESC']],
      limit: 100
    });

    res.status(200).json({ success: true, data: movements });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving inventory movements.' });
  }
};

