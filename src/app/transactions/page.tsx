
import { getTransactions, getAccounts, getCategories } from '@/lib/data';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { cookies } from 'next/headers';
import Header from '@/components/layout/Header';

export default async function AllTransactionsPage() {
  const cookieStore = await cookies();
  const activeBookId = cookieStore.get('activeBookId')?.value || 'book_default';

  const [transactions, accounts, categories] = await Promise.all([
    getTransactions(activeBookId),
    getAccounts(activeBookId),
    getCategories(activeBookId),
  ]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <RecentTransactions transactions={transactions} accounts={accounts} categories={categories} />
    </div>
  );
}

    