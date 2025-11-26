
import { getAccounts, getCategories, getTransactions } from '@/lib/data';
import type { Account, Transaction, Category } from '@/lib/types';
import CategoriesClient from '@/components/categories/CategoriesClient';
import { cookies } from 'next/headers';

type AccountWithBalance = Account & { balance: number };
type CategoryWithDetails = Category & {
  accounts: AccountWithBalance[];
  totalBalance: number;
};

export default async function CategoriesPage() {
  const cookieStore = await cookies();
  const activeBookId = cookieStore.get('activeBookId')?.value || 'book_default';

  const [accounts, categories, transactions] = await Promise.all([
    getAccounts(activeBookId),
    getCategories(activeBookId),
    getTransactions(activeBookId),
  ]);

  const categoriesWithDetails: CategoryWithDetails[] = categories.map((category) => {
    const accountsInCategory = accounts.filter((acc) => acc.categoryId === category.id);
    
    const accountsWithBalances = accountsInCategory.map((account) => {
      const accountEntries = transactions.flatMap((t) => t.entries).filter((e) => e.accountId === account.id);
      const totalDebit = accountEntries.filter((e) => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);
      const totalCredit = accountEntries.filter((e) => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);

      // Raw balance is always Debit - Credit
      const balance = totalDebit - totalCredit;

      return { ...account, balance };
    });

    const totalBalance = accountsWithBalances.reduce((sum, acc) => sum + acc.balance, 0);

    return {
      ...category,
      accounts: accountsWithBalances,
      totalBalance,
    };
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <CategoriesClient 
          categories={categoriesWithDetails} 
          allCategories={categories}
      />
    </div>
  );
}
