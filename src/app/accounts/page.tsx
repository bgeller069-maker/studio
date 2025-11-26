
import { getAccounts, getCategories, getTransactions } from '@/lib/data';
import AccountsClient from '@/components/accounts/AccountsClient';
import { cookies } from 'next/headers';
import type { Transaction } from '@/lib/types';

export default async function AllAccountsPage() {
  const activeBookId = cookies().get('activeBookId')?.value || 'book_default';

  const [accounts, categories, transactions] = await Promise.all([
    getAccounts(activeBookId),
    getCategories(activeBookId),
    getTransactions(activeBookId),
  ]);
  
  // Filter out the Opening Balance Equity account
  const visibleAccounts = accounts.filter(account => !account.id.startsWith('acc_opening_balance_equity_'));


  const accountsWithDetails = visibleAccounts.map((account) => {
    const accountEntries = transactions.flatMap(t => t.entries).filter(e => e.accountId === account.id);
    const totalDebit = accountEntries.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);
    const totalCredit = accountEntries.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);

    const balance = totalDebit - totalCredit;
    
    const accountTransactions = transactions.filter(t => t.entries.some(e => e.accountId === account.id));
    
    // Find the opening balance transaction
    const openingBalanceTransaction = accountTransactions.find(
      (t) =>
        t.description === `Opening Balance for ${account.name}` &&
        t.entries.some((e) => e.accountId === account.id)
    );

    // Find the most recent transaction date
    const lastTransactionDate = accountTransactions.length > 0
        ? accountTransactions.reduce((latest, tx) => new Date(tx.date) > new Date(latest.date) ? tx : latest).date
        : null;

    return { ...account, balance, openingBalanceTransaction: openingBalanceTransaction || null, lastTransactionDate };
  });

  const totalDebitBalance = accountsWithDetails
    .filter(a => a.balance >= 0)
    .reduce((sum, a) => sum + a.balance, 0);
    
  const totalCreditBalance = accountsWithDetails
    .filter(a => a.balance < 0)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);


  return (
    <AccountsClient
      initialAccounts={accountsWithDetails}
      categories={categories}
      totals={{ debit: totalDebitBalance, credit: totalCreditBalance }}
    />
  );
}
