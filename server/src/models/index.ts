import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

// 1. Department Model
export class Department extends Model {
  declare public id: string;
  declare public code: string;
  declare public name: string;
  declare public quarterly_budget: number;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
Department.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING(16), unique: true, allowNull: false },
  name: { type: DataTypes.STRING(128), allowNull: false },
  quarterly_budget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 500000.00 }
}, { sequelize, tableName: 'departments', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 2. Role Model
export class Role extends Model {
  declare public id: number;
  declare public name: string;
  declare public description: string;
  declare public permissions: Record<string, any>;
}
Role.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(32), unique: true, allowNull: false },
  description: { type: DataTypes.STRING(255) },
  permissions: { type: DataTypes.JSONB, defaultValue: {} }
}, { sequelize, tableName: 'roles', timestamps: false });

// 3. User Model
export class User extends Model {
  declare public id: string;
  declare public email: string;
  declare public password_hash: string;
  declare public first_name: string;
  declare public last_name: string;
  declare public role_id: number;
  declare public department_id: string;
  declare public is_active: boolean;
  declare public failed_attempts: number;
  declare public locked_until: Date | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
User.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  first_name: { type: DataTypes.STRING(64), allowNull: false },
  last_name: { type: DataTypes.STRING(64), allowNull: false },
  role_id: { type: DataTypes.INTEGER, allowNull: false },
  department_id: { type: DataTypes.UUID, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  failed_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  locked_until: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 4. Employee Model
export class Employee extends Model {
  declare public id: string;
  declare public user_id: string;
  declare public employee_code: string;
  declare public designation: string;
  declare public joining_date: Date;
  declare public base_salary: number;
  declare public annual_leave_balance: number;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
Employee.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, unique: true, allowNull: false },
  employee_code: { type: DataTypes.STRING(32), unique: true, allowNull: false },
  designation: { type: DataTypes.STRING(64), allowNull: false },
  joining_date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  base_salary: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  annual_leave_balance: { type: DataTypes.INTEGER, defaultValue: 18 }
}, { sequelize, tableName: 'employees', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 5. InventoryItem Model
export class InventoryItem extends Model {
  declare public id: string;
  declare public sku_code: string;
  declare public name: string;
  declare public category: string;
  declare public unit_of_measure: string;
  declare public unit_price: number;
  declare public stock_qty: number;
  declare public safety_stock: number;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
InventoryItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sku_code: { type: DataTypes.STRING(32), unique: true, allowNull: false },
  name: { type: DataTypes.STRING(128), allowNull: false },
  category: { type: DataTypes.STRING(64), allowNull: false },
  unit_of_measure: { type: DataTypes.STRING(16), defaultValue: 'PCS' },
  unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
  safety_stock: { type: DataTypes.INTEGER, defaultValue: 10 }
}, { sequelize, tableName: 'inventory_items', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 6. PurchaseRequest Model
export class PurchaseRequest extends Model {
  declare public id: string;
  declare public pr_code: string;
  declare public requester_id: string;
  declare public department_id: string;
  declare public item_id: string;
  declare public quantity: number;
  declare public estimated_total: number;
  declare public status: 'DRAFT' | 'PENDING_MANAGER' | 'PENDING_FINANCE' | 'APPROVED' | 'PO_ISSUED' | 'GOODS_RECEIVED' | 'INVOICE_MATCHED' | 'CLOSED' | 'REJECTED';
  declare public justification: string;
  declare public rejection_reason: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
PurchaseRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pr_code: { type: DataTypes.STRING(32), unique: true, allowNull: false },
  requester_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID, allowNull: false },
  item_id: { type: DataTypes.UUID, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  estimated_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: {
    type: DataTypes.ENUM('DRAFT', 'PENDING_MANAGER', 'PENDING_FINANCE', 'APPROVED', 'PO_ISSUED', 'GOODS_RECEIVED', 'INVOICE_MATCHED', 'CLOSED', 'REJECTED'),
    defaultValue: 'DRAFT'
  },
  justification: { type: DataTypes.TEXT, allowNull: false },
  rejection_reason: { type: DataTypes.TEXT, allowNull: true }
}, { sequelize, tableName: 'purchase_requests', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 7. PurchaseOrder Model
export class PurchaseOrder extends Model {
  declare public id: string;
  declare public po_number: string;
  declare public pr_id: string;
  declare public vendor_name: string;
  declare public ordered_quantity: number;
  declare public total_amount: number;
  declare public issued_date: Date;
  declare public readonly created_at: Date;
}
PurchaseOrder.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  po_number: { type: DataTypes.STRING(32), unique: true, allowNull: false },
  pr_id: { type: DataTypes.UUID, unique: true, allowNull: false },
  vendor_name: { type: DataTypes.STRING(128), allowNull: false },
  ordered_quantity: { type: DataTypes.INTEGER, allowNull: false },
  total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  issued_date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW }
}, { sequelize, tableName: 'purchase_orders', timestamps: true, createdAt: 'created_at', updatedAt: false });

// 8. GoodsReceivedNote Model
export class GoodsReceivedNote extends Model {
  declare public id: string;
  declare public grn_code: string;
  declare public po_id: string;
  declare public received_quantity: number;
  declare public verified_by: string;
  declare public readonly received_at: Date;
}
GoodsReceivedNote.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  grn_code: { type: DataTypes.STRING(32), unique: true, allowNull: false },
  po_id: { type: DataTypes.UUID, allowNull: false },
  received_quantity: { type: DataTypes.INTEGER, allowNull: false },
  verified_by: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, tableName: 'goods_received_notes', timestamps: true, createdAt: 'received_at', updatedAt: false });

// 9. LedgerEntry Model
export class LedgerEntry extends Model {
  declare public id: number;
  declare public transaction_uuid: string;
  declare public account_code: string;
  declare public debit_amount: number;
  declare public credit_amount: number;
  declare public reference_type: string | null;
  declare public reference_id: string | null;
  declare public readonly posted_at: Date;
}
LedgerEntry.init({
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  transaction_uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
  account_code: { type: DataTypes.STRING(32), allowNull: false },
  debit_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  credit_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  reference_type: { type: DataTypes.STRING(32), allowNull: true },
  reference_id: { type: DataTypes.UUID, allowNull: true }
}, { sequelize, tableName: 'ledger_entries', timestamps: true, createdAt: 'posted_at', updatedAt: false });

// 10. AuditLog Model
export class AuditLog extends Model {
  declare public id: number;
  declare public actor_id: string | null;
  declare public action: string;
  declare public entity_name: string;
  declare public entity_id: string;
  declare public diff_payload: Record<string, any>;
  declare public previous_hash: string;
  declare public current_hash: string;
  declare public readonly timestamp: Date;
}
AuditLog.init({
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  actor_id: { type: DataTypes.UUID, allowNull: true },
  action: { type: DataTypes.STRING(64), allowNull: false },
  entity_name: { type: DataTypes.STRING(64), allowNull: false },
  entity_id: { type: DataTypes.UUID, allowNull: false },
  diff_payload: { type: DataTypes.JSONB, defaultValue: {} },
  previous_hash: { type: DataTypes.STRING(64), allowNull: false },
  current_hash: { type: DataTypes.STRING(64), allowNull: false }
}, { sequelize, tableName: 'audit_logs', timestamps: false });

// 11. RefreshToken Model
export class RefreshToken extends Model {
  declare public id: string;
  declare public user_id: string;
  declare public token_hash: string;
  declare public expires_at: Date;
  declare public revoked_at: Date | null;
  declare public replaced_by_token_hash: string | null;
  declare public readonly created_at: Date;
}
RefreshToken.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  token_hash: { type: DataTypes.STRING(64), unique: true, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  revoked_at: { type: DataTypes.DATE, allowNull: true },
  replaced_by_token_hash: { type: DataTypes.STRING(64), allowNull: true }
}, { sequelize, tableName: 'refresh_tokens', timestamps: true, createdAt: 'created_at', updatedAt: false });

// Relationships
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
User.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
User.hasOne(Employee, { foreignKey: 'user_id', as: 'employee' });
Employee.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refresh_tokens' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

PurchaseRequest.belongsTo(User, { foreignKey: 'requester_id', as: 'requester' });
PurchaseRequest.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
PurchaseRequest.belongsTo(InventoryItem, { foreignKey: 'item_id', as: 'item' });
PurchaseRequest.hasOne(PurchaseOrder, { foreignKey: 'pr_id', as: 'purchase_order' });

PurchaseOrder.belongsTo(PurchaseRequest, { foreignKey: 'pr_id', as: 'purchase_request' });
PurchaseOrder.hasMany(GoodsReceivedNote, { foreignKey: 'po_id', as: 'grns' });

GoodsReceivedNote.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });
GoodsReceivedNote.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });
