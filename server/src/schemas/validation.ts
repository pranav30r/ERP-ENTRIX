import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const purchaseRequestSchema = z.object({
  item_id: z.string().uuid('Invalid inventory SKU UUID'),
  quantity: z.number().int().positive('Quantity must be an integer greater than 0'),
  justification: z.string().min(5, 'Justification must be at least 5 characters')
});

export const inventoryItemSchema = z.object({
  sku_code: z.string().min(3).max(32),
  name: z.string().min(3).max(128),
  category: z.string().min(2).max(64),
  unit_of_measure: z.string().max(16).default('PCS'),
  unit_price: z.number().positive(),
  stock_qty: z.number().int().nonnegative().default(0),
  safety_stock: z.number().int().nonnegative().default(10)
});
