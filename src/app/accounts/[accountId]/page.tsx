
import { getAccounts, getTransactions, getCategories } from '@/lib/data';
import type { Account, Transaction, TransactionEntry } from '@/lib/types';
import { notFound } from 'next/navigation';
import AccountLedgerClient from '@/components/accounts/AccountLedgerClient';
import { cookies } from 'next/headers';


type LedgerEntry = {
  transactionId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export default async function AccountLedgerPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const cookieStore = await cookies();
  const activeBookId = cookieStore.get('activeBookId')?.value || 'book_default';

  const [accounts, transactions, categories] = await Promise.all([
    getAccounts(activeBookId),
    getTransactions(activeBookId),
    getCategories(activeBookId),
  ]);

  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    notFound();
  }
  
  const category = categories.find(c => c.id === account.categoryId);
  const categoryName = category?.name || 'Uncategorized';
  
  // Account types that normally have a debit balance. We now use the category name to infer this.
  const debitBalanceCategories = ['asset', 'expense'];
  const normallyDebit = category ? debitBalanceCategories.some(t => category.name.toLowerCase().includes(t)) : false;

  const relevantTransactions = transactions
    .filter((t) => t.entries.some((e) => e.accountId === accountId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;

  const allLedgerEntries: LedgerEntry[] = relevantTransactions.map((tx) => {
    const entry = tx.entries.find((e) => e.accountId === accountId)!;
    const debit = entry.type === 'debit' ? entry.amount : 0;
    const credit = entry.type === 'credit' ? entry.amount : 0;

    if (normallyDebit) {
        runningBalance += debit - credit;
    } else {
        runningBalance += credit - debit;
    }

    return {
      transactionId: tx.id,
      date: tx.date,
      description: entry.description || tx.description,
      debit,
      credit,
      balance: runningBalance,
    };
  });
  
  return <AccountLedgerClient account={account} allLedgerEntries={allLedgerEntries} categoryName={categoryName} normallyDebit={normallyDebit} />;
}
