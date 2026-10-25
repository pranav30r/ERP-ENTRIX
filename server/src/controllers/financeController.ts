import { Request, Response } from 'express';
import { LedgerEntry } from '../models';

export const getLedgerEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    let entries = await LedgerEntry.findAll({
      order: [['posted_at', 'DESC']],
      limit: 50
    });

    // Seed default ledger postings if empty
    if (entries.length === 0) {
      await LedgerEntry.bulkCreate([
        {
          account_code: '1010 - Operating Cash',
          debit_amount: 0.00,
          credit_amount: 13100.00,
          reference_type: 'PO_SETTLEMENT'
        },
        {
          account_code: '1510 - Raw Material Inventory',
          debit_amount: 13100.00,
          credit_amount: 0.00,
          reference_type: 'GRN_INTAKE'
        },
        {
          account_code: '5020 - Office Supplies Expense',
          debit_amount: 4200.00,
          credit_amount: 0.00,
          reference_type: 'PR_EXPENSE'
        },
        {
          account_code: '1010 - Operating Cash',
          debit_amount: 0.00,
          credit_amount: 4200.00,
          reference_type: 'VENDOR_PAYMENT'
        }
      ]);

      entries = await LedgerEntry.findAll({
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
