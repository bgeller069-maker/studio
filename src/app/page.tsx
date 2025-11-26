import { getAccounts, getCategories, getTransactions, getBooks } from '@/lib/data';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { cookies } from 'next/headers';
import Header from '@/components/layout/Header';

export default async function Home() {
  const cookieStore = await cookies();
  const activeBookId = cookieStore.get('activeBookId')?.value || 'book_default';

  const [initialTransactions, accounts, categories] = await Promise.all([
    getTransactions(activeBookId),
    getAccounts(activeBookId),
    getCategories(activeBookId),
  ]);

  return (
    <>
      <Header />
      <DashboardClient
        initialTransactions={initialTransactions}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
