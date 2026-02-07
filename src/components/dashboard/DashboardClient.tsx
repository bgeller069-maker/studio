
'use client';

import type { Account, Category, Transaction } from '@/lib/types';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Folder, PlusCircle, Settings, List, Users, MoreVertical } from 'lucide-react';
import { Logo } from '@/components/icons/Logo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AddTransactionForm from '@/components/transactions/AddTransactionForm';
import StatCards from './StatCards';
import RecentTransactions from './RecentTransactions';
import Link from 'next/link';
import CategoryAccounts from './CategoryAccounts';
import { useBooks } from '@/context/BookContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import Header from '../layout/Header';
import { Input } from '../ui/input';
import { useRouter } from 'next/navigation';
import { Combobox } from '../ui/combobox';
import Notes from './Notes';

/** Default category: "Cash & Bank" only when present, otherwise first category */
function getDefaultCategoryId(categories: Category[]): string | undefined {
  if (!categories.length) return undefined;
  const cashAndBank = categories.find(c => c.name === 'Cash & Bank');
  return (cashAndBank || categories[0])?.id;
}

type DashboardClientProps = {
  initialTransactions: Transaction[];
  accounts: Account[];
  categories: Category[];
};

export default function DashboardClient({ initialTransactions, accounts, categories }: DashboardClientProps) {
  const { isLoading: isBookLoading, activeBook } = useBooks();
  const [isAddTxSheetOpen, setAddTxSheetOpen] = useState(false);
  const defaultCategoryId = getDefaultCategoryId(categories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(defaultCategoryId);
  const router = useRouter();

  const prevBookIdRef = useRef<string | null>(null);

  // When book or categories change (e.g. after switching book and router.refresh()), sync selection
  // so CategoryAccounts stays visible with a valid category (Cash/Capital by default).
  useEffect(() => {
    const defaultId = getDefaultCategoryId(categories);
    if (!defaultId) return;
    const bookId = activeBook?.id ?? null;
    if (prevBookIdRef.current !== bookId) {
      prevBookIdRef.current = bookId;
      setSelectedCategoryId(defaultId);
      return;
    }
    const currentValid = categories.some(c => c.id === selectedCategoryId);
    if (!currentValid) setSelectedCategoryId(defaultId);
  }, [activeBook?.id, categories, selectedCategoryId]);

  const stats = useMemo(() => {
    const totalDebit = initialTransactions.flatMap(t => t.entries).filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);
    const totalCredit = initialTransactions.flatMap(t => t.entries).filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);

    let accountsInSelectedCategory;
    if (selectedCategoryId) {
        accountsInSelectedCategory = accounts
            .filter(acc => acc.categoryId === selectedCategoryId)
            .map(account => {
                const accountEntries = initialTransactions.flatMap(t => t.entries).filter(e => e.accountId === account.id);
                const totalDebit = accountEntries.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);
                const totalCredit = accountEntries.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
                let balance = 0;
                balance = totalDebit - totalCredit;
                return { ...account, balance };
            })
            .filter(acc => acc.balance !== 0);
    }

    return {
      totalDebit,
      totalCredit,
      difference: totalDebit - totalCredit,
      accountsInSelectedCategory,
    };
  }, [initialTransactions, accounts, selectedCategoryId]);

  const selectedCategoryName = categories.find(c => c.id === selectedCategoryId)?.name;
  
  if (isBookLoading) {
      return <div>Loading...</div>; // Or a proper skeleton loader
  }
  
  const accountOptions = accounts.map(acc => ({ value: acc.id, label: acc.name }));
  
  const handleAccountSearchSelect = (accountId: string) => {
      if (accountId) {
          router.push(`/accounts/${accountId}`);
      }
  }


  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:px-8">
        <div className="space-y-8">

          <Button onClick={() => setAddTxSheetOpen(true)} size="lg" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            ADD NEW
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-8">
               {selectedCategoryName && (
                <CategoryAccounts
                    categoryName={selectedCategoryName}
                    accounts={stats.accountsInSelectedCategory ?? []}
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onCategoryChange={setSelectedCategoryId}
                />
               )}
            </div>
            <div className="space-y-8">
              <Notes />
            </div>
          </div>
          
          <RecentTransactions transactions={initialTransactions} accounts={accounts} categories={categories} />
        </div>
      </main>

      <Dialog open={isAddTxSheetOpen} onOpenChange={setAddTxSheetOpen}>
        <DialogContent className="sm:max-w-3xl w-full overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Add New Transaction</DialogTitle>
          </DialogHeader>
          <AddTransactionForm accounts={accounts} categories={categories} bookId={activeBook?.id || ''} onFinished={() => setAddTxSheetOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
