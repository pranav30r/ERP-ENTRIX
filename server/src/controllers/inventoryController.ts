import { Request, Response } from 'express';
import { InventoryItem } from '../models';

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await InventoryItem.findAll({
      order: [['created_at', 'DESC']]
    });

    const lowStockCount = items.filter(i => i.stock_qty <= i.safety_stock).length;

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
