import { Request, Response } from 'express';
import { InventoryItem } from '../models';
import { AuditService } from '../services/auditService';

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await InventoryItem.findAll({
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

    const existing = await InventoryItem.findOne({ where: { sku_code } });
    if (existing) {
      res.status(400).json({ success: false, error: `SKU code '${sku_code}' already exists.` });
      return;
    }

    const item = await InventoryItem.create({
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
  try {
    const { id } = req.params;
    const { quantity, type, reason } = req.body; // type: 'IN' | 'OUT'
    const user = (req as any).user;

    const item = await InventoryItem.findByPk(id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found.' });
      return;
    }

    const previousQty = item.stock_qty;
    const qtyChange = Number(quantity);
    if (isNaN(qtyChange) || qtyChange <= 0) {
      res.status(400).json({ success: false, error: 'Valid positive quantity required.' });
      return;
    }

    const newQty = type === 'IN' ? previousQty + qtyChange : Math.max(0, previousQty - qtyChange);
    item.stock_qty = newQty;
    await item.save();

    // Record cryptographic audit log
    await AuditService.logMutation(
      user ? user.id : null,
      `STOCK_${type}_ADJUSTMENT`,
      'inventory_items',
      item.id,
      { previous_qty: previousQty, new_qty: newQty, reason: reason || 'Manual adjustment' }
    );

    // Socket.io real-time broadcast
    if ((req as any).io) {
      (req as any).io.emit('inventory_updated', item);
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error adjusting stock level.' });
  }
};
