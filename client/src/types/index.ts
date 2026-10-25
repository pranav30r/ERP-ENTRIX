// ENTRIX ERP — Domain Data Types

export type RoleName = 
  | 'SUPER_ADMIN' 
  | 'HR_MANAGER' 
  | 'FINANCE_OFFICER' 
  | 'PROCUREMENT_OFFICER' 
  | 'STAFF_USER';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleName;
  department_id?: string;
}

export interface InventoryItem {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  unit_of_measure: string;
  unit_price: number;
  stock_qty: number;
  safety_stock: number;
  created_at: string;
}

export type PRStatus = 
  | 'DRAFT'
  | 'PENDING_MANAGER'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'PO_ISSUED'
  | 'GOODS_RECEIVED'
  | 'INVOICE_MATCHED'
  | 'CLOSED'
  | 'REJECTED';

export interface PurchaseRequest {
  id: string;
  pr_code: string;
  item_id: string;
  item?: InventoryItem;
  quantity: number;
  estimated_total: number;
  status: PRStatus;
  justification: string;
  rejection_reason?: string;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
  reference_type?: string;
  posted_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  designation: string;
  base_salary: number;
  annual_leave_balance: number;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ProjectMilestone {
  id: string;
  code: string;
  name: string;
  department_code: string;
  allocated_budget: number;
  consumed_budget: number;
  milestones_total: number;
  milestones_completed: number;
  logged_hours: number;
  estimated_hours: number;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  action: string;
  entity_name: string;
  entity_id: string;
  previous_hash: string;
  current_hash: string;
  diff_payload: Record<string, any>;
  timestamp: string;
}

export interface ChainVerification {
  valid: boolean;
  total_checked: number;
  broken_id?: number;
}
