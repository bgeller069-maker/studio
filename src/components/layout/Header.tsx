
'use client';

import { useState } from 'react';
import type { Account, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Folder, PlusCircle, Settings, List, Users, ArrowLeft, LogOut } from 'lucide-react';
import { Logo } from '@/components/icons/Logo';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddTransactionForm from '@/components/transactions/AddTransactionForm';
import Link from 'next/link';
import { useBooks } from '@/context/BookContext';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type HeaderProps = {
  accounts?: Account[];
  categories?: Category[];
  backHref?: string;
};

export default function Header({ accounts = [], categories = [], backHref }: HeaderProps) {
  const { activeBook } = useBooks();
  const [isAddTxSheetOpen, setAddTxSheetOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isDashboard = pathname === '/';

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.refresh();
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto px-0">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              {backHref && (
                 <Button variant="outline" size="icon" asChild className="mr-2">
                    <Link href={backHref}>
                      <ArrowLeft />
                      <span className="sr-only">Back</span>
                    </Link>
                  </Button>
              )}
              <Logo />
            </div>
            <div className="flex items-center gap-2">
              {/* Desktop Menu */}
              <div className="hidden md:flex items-center gap-2">
                {isDashboard && (
                  <>
                    <Button variant={pathname.startsWith('/transactions') ? 'secondary' : 'outline'} asChild>
                      <Link href="/transactions">
                        <List className="mr-2 h-4 w-4" />
                        All Transactions
                      </Link>
                    </Button>
                    <Button variant={pathname.startsWith('/accounts') ? 'secondary' : 'outline'} asChild>
                      <Link href="/accounts">
                        <Users className="mr-2 h-4 w-4" />
                        All Accounts
                      </Link>
                    </Button>
                    <Button variant={pathname.startsWith('/categories') ? 'secondary' : 'outline'} asChild>
                      <Link href="/categories">
                        <Folder className="mr-2 h-4 w-4" />
                        All Categories
                      </Link>
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/settings">
                    <Settings />
                    <span className="sr-only">Settings</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} disabled={isLoggingOut} title="Sign out">
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sign out</span>
                </Button>
              </div>

              {!isDashboard && (
                <Button onClick={() => setAddTxSheetOpen(true)} className="hidden md:inline-flex">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  ADD NEW
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <Dialog open={isAddTxSheetOpen} onOpenChange={setAddTxSheetOpen}>
        <DialogContent className="sm:max-w-3xl w-full overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Add New Transaction</DialogTitle>
          </DialogHeader>
          <AddTransactionForm accounts={accounts} categories={categories} bookId={activeBook?.id || ''} onFinished={() => setAddTxSheetOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
