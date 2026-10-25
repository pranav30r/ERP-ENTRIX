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
