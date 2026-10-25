import { apiClient, ensureAuthenticated } from './api';
import { 
  InventoryItem, 
  PurchaseRequest, 
  LedgerEntry, 
  Employee, 
  ProjectMilestone, 
  AuditLogEntry, 
  ChainVerification 
} from '../types';

// ==========================================
// 1. Inventory Service
// ==========================================
export const inventoryService = {
  async getAll(): Promise<{ items: InventoryItem[]; metrics: { total_items: number; low_stock_items: number } }> {
    await ensureAuthenticated();
    const res = await apiClient.get('/inventory');
    return {
      items: res.data.data || [],
      metrics: res.data.metrics || { total_items: 0, low_stock_items: 0 }
    };
  },

  async adjustStock(id: string, quantity: number, type: 'IN' | 'OUT', reason: string): Promise<InventoryItem> {
    await ensureAuthenticated();
    const res = await apiClient.patch(`/inventory/${id}/adjust`, { quantity, type, reason });
    return res.data.data;
  }
};

// ==========================================
// 2. Procurement Service
// ==========================================
export const procurementService = {
  async getRequests(): Promise<PurchaseRequest[]> {
    await ensureAuthenticated();
    const res = await apiClient.get('/procurement/requests');
    return res.data.data || [];
  },

  async createRequest(itemId: string, quantity: number, justification: string): Promise<PurchaseRequest> {
    await ensureAuthenticated();
    const res = await apiClient.post('/procurement/requests', {
      item_id: itemId,
      quantity,
      justification
    });
    return res.data.data;
  },

  async approveManager(id: string, action: 'APPROVE' | 'REJECT'): Promise<PurchaseRequest> {
    await ensureAuthenticated();
    const res = await apiClient.post(`/procurement/requests/${id}/manager-approval`, {
      action,
      comments: `${action} executed by Manager`
    });
    return res.data.data;
  },

  async approveFinance(id: string, action: 'APPROVE' | 'REJECT'): Promise<PurchaseRequest> {
    await ensureAuthenticated();
    const res = await apiClient.post(`/procurement/requests/${id}/finance-approval`, {
      action,
      comments: `${action} executed by Finance Officer`
    });
    return res.data.data;
  }
};

// ==========================================
// 3. Finance & General Ledger Service
// ==========================================
export const financeService = {
  async getLedger(): Promise<{ entries: LedgerEntry[]; summary: { total_debits: number; total_credits: number; is_balanced: boolean } }> {
    await ensureAuthenticated();
    const res = await apiClient.get('/finance/ledger');
    return {
      entries: res.data.data || [],
      summary: res.data.summary || { total_debits: 0, total_credits: 0, is_balanced: true }
    };
  }
};

// ==========================================
// 4. Human Resources Service
// ==========================================
export const hrService = {
  async getEmployees(): Promise<Employee[]> {
    await ensureAuthenticated();
    const res = await apiClient.get('/hr/employees');
    return res.data.data || [];
  }
};

// ==========================================
// 5. Projects & Resource Service
// ==========================================
export const projectService = {
  async getProjects(): Promise<ProjectMilestone[]> {
    await ensureAuthenticated();
    const res = await apiClient.get('/projects');
    return res.data.data || [];
  }
};

// ==========================================
// 6. Cryptographic Audit Service
// ==========================================
export const auditService = {
  async getAuditTrail(): Promise<{ logs: AuditLogEntry[]; integrity: ChainVerification }> {
    await ensureAuthenticated();
    const res = await apiClient.get('/audit');
    return {
      logs: res.data.data || [],
      integrity: res.data.integrity || { valid: true, total_checked: 0 }
    };
  }
};
