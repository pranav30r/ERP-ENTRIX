import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

// 0. Tenant Master Model
export class Tenant extends Model {
  declare public id: string;
  declare public name: string;
  declare public slug: string;
  declare public status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  declare public plan: string;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
Tenant.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(128), allowNull: false },
  slug: { type: DataTypes.STRING(64), unique: true, allowNull: false },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'PENDING'),
    defaultValue: 'ACTIVE'
  },
  plan: { type: DataTypes.STRING(32), defaultValue: 'ENTERPRISE' }
}, { sequelize, tableName: 'tenants', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 1. Department Model
export class Department extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public code: string;
  declare public name: string;
  declare public quarterly_budget: number;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
Department.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING(16), allowNull: false },
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
  declare public tenant_id: string | null;
  declare public email: string;
  declare public password_hash: string;
  declare public first_name: string;
  declare public last_name: string;
  declare public role_id: number;
  declare public department_id: string | null;
  declare public is_active: boolean;
  declare public failed_attempts: number;
  declare public locked_until: Date | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
User.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: true }, // null allowed for global platform admins only
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
  declare public tenant_id: string;
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
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  user_id: { type: DataTypes.UUID, unique: true, allowNull: false },
  employee_code: { type: DataTypes.STRING(32), allowNull: false },
  designation: { type: DataTypes.STRING(64), allowNull: false },
  joining_date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  base_salary: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  annual_leave_balance: { type: DataTypes.INTEGER, defaultValue: 18 }
}, { sequelize, tableName: 'employees', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 5. InventoryItem Model
export class InventoryItem extends Model {
  declare public id: string;
  declare public tenant_id: string;
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
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  sku_code: { type: DataTypes.STRING(32), allowNull: false },
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
  declare public tenant_id: string;
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
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  pr_code: { type: DataTypes.STRING(32), allowNull: false },
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
  declare public tenant_id: string;
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
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  po_number: { type: DataTypes.STRING(32), allowNull: false },
  pr_id: { type: DataTypes.UUID, unique: true, allowNull: false },
  vendor_name: { type: DataTypes.STRING(128), allowNull: false },
  ordered_quantity: { type: DataTypes.INTEGER, allowNull: false },
  total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  issued_date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW }
}, { sequelize, tableName: 'purchase_orders', timestamps: true, createdAt: 'created_at', updatedAt: false });

// 8. GoodsReceivedNote Model
export class GoodsReceivedNote extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public grn_code: string;
  declare public po_id: string;
  declare public received_quantity: number;
  declare public verified_by: string;
  declare public readonly received_at: Date;
}
GoodsReceivedNote.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  grn_code: { type: DataTypes.STRING(32), allowNull: false },
  po_id: { type: DataTypes.UUID, allowNull: false },
  received_quantity: { type: DataTypes.INTEGER, allowNull: false },
  verified_by: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, tableName: 'goods_received_notes', timestamps: true, createdAt: 'received_at', updatedAt: false });

// 9. LedgerEntry Model
export class LedgerEntry extends Model {
  declare public id: number;
  declare public tenant_id: string;
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
  tenant_id: { type: DataTypes.UUID, allowNull: false },
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
  declare public tenant_id: string;
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
  tenant_id: { type: DataTypes.UUID, allowNull: false },
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

// 12. TenantInvitation Model
export class TenantInvitation extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public email: string;
  declare public role_id: number;
  declare public token_hash: string;
  declare public expires_at: Date;
  declare public accepted_at: Date | null;
  declare public readonly created_at: Date;
}
TenantInvitation.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false },
  role_id: { type: DataTypes.INTEGER, allowNull: false },
  token_hash: { type: DataTypes.STRING(64), unique: true, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  accepted_at: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, tableName: 'tenant_invitations', timestamps: true, createdAt: 'created_at', updatedAt: false });

// Model Associations
Tenant.hasMany(User, { foreignKey: 'tenant_id', as: 'users' });
User.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Department, { foreignKey: 'tenant_id', as: 'departments' });
Department.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Employee, { foreignKey: 'tenant_id', as: 'employees' });
Employee.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(InventoryItem, { foreignKey: 'tenant_id', as: 'inventory_items' });
InventoryItem.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(PurchaseRequest, { foreignKey: 'tenant_id', as: 'purchase_requests' });
PurchaseRequest.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(PurchaseOrder, { foreignKey: 'tenant_id', as: 'purchase_orders' });
PurchaseOrder.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(GoodsReceivedNote, { foreignKey: 'tenant_id', as: 'goods_received_notes' });
GoodsReceivedNote.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(LedgerEntry, { foreignKey: 'tenant_id', as: 'ledger_entries' });
LedgerEntry.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(AuditLog, { foreignKey: 'tenant_id', as: 'audit_logs' });
AuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(TenantInvitation, { foreignKey: 'tenant_id', as: 'invitations' });
TenantInvitation.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

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

// 13. AttendanceRecord Model
export class AttendanceRecord extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public employee_id: string;
  declare public date: string;
  declare public status: 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'HALF_DAY';
  declare public check_in_time: string | null;
  declare public check_out_time: string | null;
  declare public notes: string | null;
  declare public readonly created_at: Date;
}
AttendanceRecord.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  employee_id: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  status: {
    type: DataTypes.ENUM('PRESENT', 'ABSENT', 'ON_LEAVE', 'HALF_DAY'),
    defaultValue: 'PRESENT'
  },
  check_in_time: { type: DataTypes.TIME, defaultValue: '09:00:00' },
  check_out_time: { type: DataTypes.TIME, defaultValue: '18:00:00' },
  notes: { type: DataTypes.STRING(255), allowNull: true }
}, { sequelize, tableName: 'attendance_records', timestamps: true, createdAt: 'created_at', updatedAt: false });

Tenant.hasMany(AttendanceRecord, { foreignKey: 'tenant_id', as: 'attendance_records' });
AttendanceRecord.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Employee.hasMany(AttendanceRecord, { foreignKey: 'employee_id', as: 'attendance_records' });
AttendanceRecord.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// 14. Subscription Model
export class Subscription extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public plan_tier: string;
  declare public status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED' | 'EXPIRED';
  declare public current_period_start: Date;
  declare public current_period_end: Date;
  declare public trial_ends_at: Date | null;
  declare public cancel_at_period_end: boolean;
  declare public canceled_at: Date | null;
  declare public billing_customer_id: string | null;
  declare public billing_subscription_id: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
Subscription.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false, unique: true },
  plan_tier: { type: DataTypes.STRING(32), defaultValue: 'STARTER', allowNull: false },
  status: {
    type: DataTypes.ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED'),
    defaultValue: 'TRIALING',
    allowNull: false
  },
  current_period_start: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, allowNull: false },
  current_period_end: { type: DataTypes.DATE, allowNull: false },
  trial_ends_at: { type: DataTypes.DATE, allowNull: true },
  cancel_at_period_end: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
  canceled_at: { type: DataTypes.DATE, allowNull: true },
  billing_customer_id: { type: DataTypes.STRING(128), allowNull: true },
  billing_subscription_id: { type: DataTypes.STRING(128), allowNull: true }
}, { sequelize, tableName: 'subscriptions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 15. SubscriptionHistory Model
export class SubscriptionHistory extends Model {
  declare public id: number;
  declare public subscription_id: string;
  declare public tenant_id: string;
  declare public from_status: string | null;
  declare public to_status: string;
  declare public from_plan: string | null;
  declare public to_plan: string;
  declare public reason: string | null;
  declare public actor_id: string | null;
  declare public readonly created_at: Date;
}
SubscriptionHistory.init({
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  subscription_id: { type: DataTypes.UUID, allowNull: false },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  from_status: { type: DataTypes.STRING(32), allowNull: true },
  to_status: { type: DataTypes.STRING(32), allowNull: false },
  from_plan: { type: DataTypes.STRING(32), allowNull: true },
  to_plan: { type: DataTypes.STRING(32), allowNull: false },
  reason: { type: DataTypes.STRING(255), allowNull: true },
  actor_id: { type: DataTypes.UUID, allowNull: true }
}, { sequelize, tableName: 'subscription_history', timestamps: true, createdAt: 'created_at', updatedAt: false });

// 16. TenantUsageCounter Model
export class TenantUsageCounter extends Model {
  declare public id: number;
  declare public tenant_id: string;
  declare public metric_name: string;
  declare public current_value: number;
  declare public period_start: Date;
  declare public period_end: Date;
  declare public readonly updated_at: Date;
}
TenantUsageCounter.init({
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  metric_name: { type: DataTypes.STRING(64), allowNull: false },
  current_value: { type: DataTypes.BIGINT, defaultValue: 0, allowNull: false },
  period_start: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, allowNull: false },
  period_end: { type: DataTypes.DATE, allowNull: false }
}, { sequelize, tableName: 'tenant_usage_counters', timestamps: true, createdAt: false, updatedAt: 'updated_at' });

// 17. SubscriptionInvoice Model
export class SubscriptionInvoice extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public subscription_id: string | null;
  declare public invoice_number: string;
  declare public amount_due: number;
  declare public amount_paid: number;
  declare public currency: string;
  declare public status: 'DRAFT' | 'OPEN' | 'PAID' | 'UNCOLLECTIBLE' | 'VOID';
  declare public period_start: Date;
  declare public period_end: Date;
  declare public hosted_invoice_url: string | null;
  declare public pdf_download_url: string | null;
  declare public readonly created_at: Date;
}
SubscriptionInvoice.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  subscription_id: { type: DataTypes.UUID, allowNull: true },
  invoice_number: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  amount_due: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00, allowNull: false },
  amount_paid: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00, allowNull: false },
  currency: { type: DataTypes.STRING(8), defaultValue: 'INR', allowNull: false },
  status: {
    type: DataTypes.ENUM('DRAFT', 'OPEN', 'PAID', 'UNCOLLECTIBLE', 'VOID'),
    defaultValue: 'PAID',
    allowNull: false
  },
  period_start: { type: DataTypes.DATE, allowNull: false },
  period_end: { type: DataTypes.DATE, allowNull: false },
  hosted_invoice_url: { type: DataTypes.STRING(255), allowNull: true },
  pdf_download_url: { type: DataTypes.STRING(255), allowNull: true }
}, { sequelize, tableName: 'subscription_invoices', timestamps: true, createdAt: 'created_at', updatedAt: false });

Tenant.hasOne(Subscription, { foreignKey: 'tenant_id', as: 'subscription' });
Subscription.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Subscription.hasMany(SubscriptionHistory, { foreignKey: 'subscription_id', as: 'history' });
SubscriptionHistory.belongsTo(Subscription, { foreignKey: 'subscription_id', as: 'subscription' });

Tenant.hasMany(TenantUsageCounter, { foreignKey: 'tenant_id', as: 'usage_counters' });
TenantUsageCounter.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(SubscriptionInvoice, { foreignKey: 'tenant_id', as: 'invoices' });
SubscriptionInvoice.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Subscription.hasMany(SubscriptionInvoice, { foreignKey: 'subscription_id', as: 'invoices' });
SubscriptionInvoice.belongsTo(Subscription, { foreignKey: 'subscription_id', as: 'subscription' });

// 18. Supplier Model
export class Supplier extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public code: string;
  declare public name: string;
  declare public email: string | null;
  declare public phone: string | null;
  declare public payment_terms: string;
  declare public rating: number;
  declare public is_active: boolean;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
Supplier.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING(32), allowNull: false },
  name: { type: DataTypes.STRING(128), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(32), allowNull: true },
  payment_terms: { type: DataTypes.STRING(64), defaultValue: 'NET30' },
  rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 5.00 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { sequelize, tableName: 'suppliers', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 19. SupplierInvoice Model (3-Way Matching)
export class SupplierInvoice extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public invoice_number: string;
  declare public supplier_id: string | null;
  declare public po_id: string | null;
  declare public grn_id: string | null;
  declare public billed_quantity: number;
  declare public invoice_amount: number;
  declare public status: 'PENDING_MATCH' | 'MATCHED' | 'DISCREPANCY' | 'PAID';
  declare public discrepancy_notes: string | null;
  declare public matched_at: Date | null;
  declare public readonly created_at: Date;
}
SupplierInvoice.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  invoice_number: { type: DataTypes.STRING(64), allowNull: false },
  supplier_id: { type: DataTypes.UUID, allowNull: true },
  po_id: { type: DataTypes.UUID, allowNull: true },
  grn_id: { type: DataTypes.UUID, allowNull: true },
  billed_quantity: { type: DataTypes.INTEGER, allowNull: false },
  invoice_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: {
    type: DataTypes.ENUM('PENDING_MATCH', 'MATCHED', 'DISCREPANCY', 'PAID'),
    defaultValue: 'PENDING_MATCH'
  },
  discrepancy_notes: { type: DataTypes.TEXT, allowNull: true },
  matched_at: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, tableName: 'supplier_invoices', timestamps: true, createdAt: 'created_at', updatedAt: false });

// 20. InventoryMovement Model
export class InventoryMovement extends Model {
  declare public id: number;
  declare public tenant_id: string;
  declare public item_id: string;
  declare public movement_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RESERVED';
  declare public quantity: number;
  declare public previous_stock: number;
  declare public new_stock: number;
  declare public reference_type: string | null;
  declare public reference_id: string | null;
  declare public notes: string | null;
  declare public readonly created_at: Date;
}
InventoryMovement.init({
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  item_id: { type: DataTypes.UUID, allowNull: false },
  movement_type: {
    type: DataTypes.ENUM('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RESERVED'),
    allowNull: false
  },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  previous_stock: { type: DataTypes.INTEGER, allowNull: false },
  new_stock: { type: DataTypes.INTEGER, allowNull: false },
  reference_type: { type: DataTypes.STRING(64), allowNull: true },
  reference_id: { type: DataTypes.UUID, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
}, { sequelize, tableName: 'inventory_movements', timestamps: true, createdAt: 'created_at', updatedAt: false });

// 21. LeaveRequest Model
export class LeaveRequest extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public employee_id: string;
  declare public leave_type: 'ANNUAL' | 'SICK' | 'UNPAID' | 'CASUAL';
  declare public start_date: string;
  declare public end_date: string;
  declare public days_count: number;
  declare public reason: string;
  declare public status: 'PENDING' | 'APPROVED' | 'REJECTED';
  declare public reviewed_by: string | null;
  declare public rejection_reason: string | null;
  declare public reviewed_at: Date | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
LeaveRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  employee_id: { type: DataTypes.UUID, allowNull: false },
  leave_type: {
    type: DataTypes.ENUM('ANNUAL', 'SICK', 'UNPAID', 'CASUAL'),
    defaultValue: 'ANNUAL'
  },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  days_count: { type: DataTypes.INTEGER, defaultValue: 1 },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    defaultValue: 'PENDING'
  },
  reviewed_by: { type: DataTypes.UUID, allowNull: true },
  rejection_reason: { type: DataTypes.TEXT, allowNull: true },
  reviewed_at: { type: DataTypes.DATE, allowNull: true }
}, { sequelize, tableName: 'leave_requests', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 22. Project Model
export class Project extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public code: string;
  declare public name: string;
  declare public department_code: string;
  declare public allocated_budget: number;
  declare public consumed_budget: number;
  declare public milestones_total: number;
  declare public milestones_completed: number;
  declare public logged_hours: number;
  declare public estimated_hours: number;
  declare public status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
Project.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING(32), allowNull: false },
  name: { type: DataTypes.STRING(128), allowNull: false },
  department_code: { type: DataTypes.STRING(32), defaultValue: 'DEPT-ENG' },
  allocated_budget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  consumed_budget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  milestones_total: { type: DataTypes.INTEGER, defaultValue: 5 },
  milestones_completed: { type: DataTypes.INTEGER, defaultValue: 0 },
  logged_hours: { type: DataTypes.INTEGER, defaultValue: 0 },
  estimated_hours: { type: DataTypes.INTEGER, defaultValue: 100 },
  status: {
    type: DataTypes.ENUM('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'),
    defaultValue: 'PLANNING'
  }
}, { sequelize, tableName: 'projects', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// 23. ProjectTask Model
export class ProjectTask extends Model {
  declare public id: string;
  declare public tenant_id: string;
  declare public project_id: string;
  declare public title: string;
  declare public assigned_user_id: string | null;
  declare public estimated_hours: number;
  declare public status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  declare public start_date: string | null;
  declare public end_date: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}
ProjectTask.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  project_id: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(128), allowNull: false },
  assigned_user_id: { type: DataTypes.UUID, allowNull: true },
  estimated_hours: { type: DataTypes.INTEGER, defaultValue: 8 },
  status: {
    type: DataTypes.ENUM('TODO', 'IN_PROGRESS', 'DONE'),
    defaultValue: 'TODO'
  },
  start_date: { type: DataTypes.DATEONLY, allowNull: true },
  end_date: { type: DataTypes.DATEONLY, allowNull: true }
}, { sequelize, tableName: 'project_tasks', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// Phase 7 Associations
Tenant.hasMany(Supplier, { foreignKey: 'tenant_id', as: 'suppliers' });
Supplier.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(SupplierInvoice, { foreignKey: 'tenant_id', as: 'supplier_invoices' });
SupplierInvoice.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Supplier.hasMany(SupplierInvoice, { foreignKey: 'supplier_id', as: 'invoices' });
SupplierInvoice.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
PurchaseOrder.hasMany(SupplierInvoice, { foreignKey: 'po_id', as: 'invoices' });
SupplierInvoice.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });
GoodsReceivedNote.hasMany(SupplierInvoice, { foreignKey: 'grn_id', as: 'invoices' });
SupplierInvoice.belongsTo(GoodsReceivedNote, { foreignKey: 'grn_id', as: 'grn' });

Tenant.hasMany(InventoryMovement, { foreignKey: 'tenant_id', as: 'inventory_movements' });
InventoryMovement.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
InventoryItem.hasMany(InventoryMovement, { foreignKey: 'item_id', as: 'movements' });
InventoryMovement.belongsTo(InventoryItem, { foreignKey: 'item_id', as: 'item' });

Tenant.hasMany(LeaveRequest, { foreignKey: 'tenant_id', as: 'leave_requests' });
LeaveRequest.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Employee.hasMany(LeaveRequest, { foreignKey: 'employee_id', as: 'leave_requests' });
LeaveRequest.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
User.hasMany(LeaveRequest, { foreignKey: 'reviewed_by', as: 'reviewed_leaves' });
LeaveRequest.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

Tenant.hasMany(Project, { foreignKey: 'tenant_id', as: 'projects' });
Project.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Project.hasMany(ProjectTask, { foreignKey: 'project_id', as: 'tasks' });
ProjectTask.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
User.hasMany(ProjectTask, { foreignKey: 'assigned_user_id', as: 'assigned_tasks' });
ProjectTask.belongsTo(User, { foreignKey: 'assigned_user_id', as: 'assignee' });


