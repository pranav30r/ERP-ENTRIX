import { Request, Response } from 'express';
import crypto from 'crypto';
import { LedgerEntry } from '../models';
import { sequelize } from '../config/db';
import { AuditService } from '../services/auditService';

export const getLedgerEntries = async (req: Request, res: Response): Promise<void> => {
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

    let entries = await LedgerEntry.findAll({
      where: whereClause,
      order: [['posted_at', 'DESC']],
      limit: 50
    });

    // Seed default ledger postings if empty for primary default tenant only
    if (entries.length === 0 && tenantId === '00000000-0000-0000-0000-000000000001') {
      const tx1 = crypto.randomUUID();
      const tx2 = crypto.randomUUID();
      const defaultTenantId = '00000000-0000-0000-0000-000000000001';
      await LedgerEntry.bulkCreate([
        {
          tenant_id: defaultTenantId,
          transaction_uuid: tx1,
          account_code: '1010 - Operating Cash',
          debit_amount: 0.00,
          credit_amount: 13100.00,
          reference_type: 'PO_SETTLEMENT'
        },
        {
          tenant_id: defaultTenantId,
          transaction_uuid: tx1,
          account_code: '1510 - Raw Material Inventory',
          debit_amount: 13100.00,
          credit_amount: 0.00,
          reference_type: 'GRN_INTAKE'
        },
        {
          tenant_id: defaultTenantId,
          transaction_uuid: tx2,
          account_code: '5020 - Office Supplies Expense',
          debit_amount: 4200.00,
          credit_amount: 0.00,
          reference_type: 'PR_EXPENSE'
        },
        {
          tenant_id: defaultTenantId,
          transaction_uuid: tx2,
          account_code: '1010 - Operating Cash',
          debit_amount: 0.00,
          credit_amount: 4200.00,
          reference_type: 'VENDOR_PAYMENT'
        }
      ]);

      entries = await LedgerEntry.findAll({
        where: whereClause,
        order: [['posted_at', 'DESC']],
        limit: 50
      });
    }

    const totalDebits = entries.reduce((acc, curr) => acc + Number(curr.debit_amount), 0);
    const totalCredits = entries.reduce((acc, curr) => acc + Number(curr.credit_amount), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    res.status(200).json({
      success: true,
      data: entries,
      summary: {
        total_debits: totalDebits,
        total_credits: totalCredits,
        is_balanced: isBalanced
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching financial ledger.' });
  }
};

export const createJournalEntry = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const { entries, reference_type, reference_id } = req.body;

    if (!Array.isArray(entries) || entries.length < 2) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: 'Journal entry must contain at least 2 line items (double-entry requirement).'
      });
      return;
    }

    let sumDebits = 0;
    let sumCredits = 0;

    for (const item of entries) {
      if (!item.account_code || typeof item.account_code !== 'string') {
        await transaction.rollback();
        res.status(400).json({ success: false, error: 'Every entry requires a valid account_code.' });
        return;
      }
      const debit = Number(item.debit_amount || 0);
      const credit = Number(item.credit_amount || 0);

      if (isNaN(debit) || debit < 0 || isNaN(credit) || credit < 0) {
        await transaction.rollback();
        res.status(400).json({ success: false, error: 'Debit and credit amounts must be non-negative numbers.' });
        return;
      }

      sumDebits += debit;
      sumCredits += credit;
    }

    // Mathematical Double-Entry Safeguard: Debits must strictly equal Credits
    if (Math.abs(sumDebits - sumCredits) > 0.001 || sumDebits <= 0) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: `Double-entry imbalance: total debits (₹${sumDebits.toFixed(2)}) must equal total credits (₹${sumCredits.toFixed(2)}).`
      });
      return;
    }

    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const transaction_uuid = crypto.randomUUID();
    const rowsToInsert = entries.map((e) => ({
      tenant_id: tenantId,
      transaction_uuid,
      account_code: e.account_code.trim(),
      debit_amount: Number(e.debit_amount || 0),
      credit_amount: Number(e.credit_amount || 0),
      reference_type: reference_type || 'MANUAL_JOURNAL',
      reference_id: reference_id || null
    }));

    const createdEntries = await LedgerEntry.bulkCreate(rowsToInsert, { transaction });

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'POST_JOURNAL_VOUCHER',
      'ledger_entries',
      transaction_uuid,
      {
        total_debits: sumDebits,
        total_credits: sumCredits,
        line_count: entries.length,
        reference_type: reference_type || 'MANUAL_JOURNAL'
      },
      transaction,
      tenantId
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Journal voucher posted successfully with verified double-entry balance.',
      data: {
        transaction_uuid,
        total_amount: sumDebits,
        entries: createdEntries
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error posting journal entry. Transaction rolled back.' });
  }
};

/**
 * Creates an outbound customer sales invoice and automatically posts balanced AR journal rows:
 * Debit 1100 - Accounts Receivable
 * Credit 4000 - Sales Revenue
 */
export const createSalesInvoice = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { customer_name, invoice_number, amount, description } = req.body;

    const numAmount = Number(amount);
    if (!customer_name || !invoice_number || isNaN(numAmount) || numAmount <= 0) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: 'Valid customer_name, invoice_number, and positive amount are required.'
      });
      return;
    }

    const txUuid = crypto.randomUUID();
    const invCode = String(invoice_number).trim();
    const custName = String(customer_name).trim();

    // 1. Post balanced AR entry
    const entries = await LedgerEntry.bulkCreate([
      {
        tenant_id: tenantId,
        transaction_uuid: txUuid,
        account_code: '1100 - Accounts Receivable',
        debit_amount: numAmount,
        credit_amount: 0.00,
        reference_type: 'CUSTOMER_INVOICE'
      },
      {
        tenant_id: tenantId,
        transaction_uuid: txUuid,
        account_code: '4000 - Sales Revenue',
        debit_amount: 0.00,
        credit_amount: numAmount,
        reference_type: 'CUSTOMER_INVOICE'
      }
    ], { transaction });

    // 2. Audit log
    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'ISSUE_CUSTOMER_INVOICE',
      'ledger_entries',
      txUuid,
      {
        customer_name: custName,
        invoice_number: invCode,
        amount: numAmount,
        description: description || 'Customer Sales Invoice'
      },
      transaction,
      tenantId
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `Customer invoice ${invCode} issued for ${custName}. General ledger updated with Dr 1100 / Cr 4000.`,
      data: {
        transaction_uuid: txUuid,
        invoice_number: invCode,
        customer_name: custName,
        amount: numAmount,
        entries
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Failed to issue customer invoice.' });
  }
};

/**
 * Records receipt of customer payment against Accounts Receivable:
 * Debit 1010 - Operating Cash
 * Credit 1100 - Accounts Receivable
 */
export const recordCustomerReceipt = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { invoice_number, amount, customer_name, payment_method } = req.body;

    const numAmount = Number(amount);
    if (!invoice_number || isNaN(numAmount) || numAmount <= 0) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: 'Valid invoice_number and positive amount are required.'
      });
      return;
    }

    const txUuid = crypto.randomUUID();
    const invCode = String(invoice_number).trim();

    // 1. Post balanced Receipt entry
    const entries = await LedgerEntry.bulkCreate([
      {
        tenant_id: tenantId,
        transaction_uuid: txUuid,
        account_code: '1010 - Operating Cash',
        debit_amount: numAmount,
        credit_amount: 0.00,
        reference_type: 'CUSTOMER_PAYMENT'
      },
      {
        tenant_id: tenantId,
        transaction_uuid: txUuid,
        account_code: '1100 - Accounts Receivable',
        debit_amount: 0.00,
        credit_amount: numAmount,
        reference_type: 'CUSTOMER_PAYMENT'
      }
    ], { transaction });

    // 2. Audit log
    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'COLLECT_CUSTOMER_PAYMENT',
      'ledger_entries',
      txUuid,
      {
        invoice_number: invCode,
        customer_name: customer_name || 'Direct Customer',
        amount: numAmount,
        payment_method: payment_method || 'BANK_TRANSFER'
      },
      transaction,
      tenantId
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Payment of ₹${numAmount} recorded for invoice ${invCode}. General ledger updated with Dr 1010 / Cr 1100.`,
      data: {
        transaction_uuid: txUuid,
        invoice_number: invCode,
        amount: numAmount,
        entries
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Failed to record customer receipt.' });
  }
};

/**
 * Returns summary metrics for Accounts Receivable (total invoiced, collected, outstanding).
 */
export const getAccountsReceivableSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;

    const arEntries = await LedgerEntry.findAll({
      where: {
        tenant_id: tenantId,
        account_code: '1100 - Accounts Receivable'
      },
      order: [['posted_at', 'DESC']],
      limit: 100
    });

    const totalInvoiced = arEntries.reduce((sum, e) => sum + Number(e.debit_amount || 0), 0);
    const totalCollected = arEntries.reduce((sum, e) => sum + Number(e.credit_amount || 0), 0);
    const outstandingBalance = totalInvoiced - totalCollected;

    res.status(200).json({
      success: true,
      data: {
        total_invoiced: totalInvoiced,
        total_collected: totalCollected,
        outstanding_balance: Math.max(0, outstandingBalance),
        recent_transactions: arEntries.slice(0, 20)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch Accounts Receivable summary.' });
  }
};
