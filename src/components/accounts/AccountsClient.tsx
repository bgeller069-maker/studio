
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Edit, PlusCircle, Trash2, ArrowUpDown, MoreVertical, Scale, ArrowLeftRight, Folder, Settings, CheckSquare, X, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Account, Category, Transaction } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { useTransition, useState, useMemo, useCallback } from 'react';
import { deleteAccountAction, deleteMultipleAccountsAction } from '@/app/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import AddAccountForm from './AddAccountForm';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Checkbox } from '../ui/checkbox';
import { useBooks } from '@/context/BookContext';
import EditAccountForm from './EditAccountForm';
import OpenBalanceDialog from './OpenBalanceDialog';


type AccountWithDetails = Account & {
    balance: number;
    lastTransactionDate: string | null;
};

type InitialAccount = AccountWithDetails & { openingBalanceTransaction?: Transaction | null };


type AccountsClientProps = {
  initialAccounts: InitialAccount[];
  categories: Category[];
  totals: {
    debit: number;
    credit: number;
  };
};

export default function AccountsClient({ initialAccounts, categories, totals }: AccountsClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDescriptor, setSortDescriptor] = useState('recent-desc');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const { activeBook } = useBooks();
  const [isSelectMode, setIsSelectMode] = useState(false);

  const getCategoryName = useCallback((categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    return categories.find((c) => c.id === categoryId)?.name || 'N/A';
  }, [categories]);
  
  const [isPending, startTransition] = useTransition();
  const [isAddSheetOpen, setAddSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<InitialAccount | null>(null);
  const [openBalanceAccount, setOpenBalanceAccount] = useState<InitialAccount | null>(null);

  const handleDelete = (accountId: string) => {
    if (!activeBook) return;
    startTransition(async () => {
      const result = await deleteAccountAction(activeBook.id, accountId);
      if (result.success) {
        // toast({ title: "Success", description: result.message });
      } else {
        // toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };
  
  const handleBulkDelete = () => {
    if (!activeBook) return;
    startTransition(async () => {
      const result = await deleteMultipleAccountsAction(activeBook.id, selectedAccounts);
      if (result.success) {
        // toast({ title: "Success", description: `${selectedAccounts.length} accounts deleted.` });
        setSelectedAccounts([]);
        setIsSelectMode(false);
      } else {
        // toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };


  const handleEdit = (account: InitialAccount) => {
    setEditingAccount(account);
  };
  
  const filteredAndSortedAccounts = useMemo(() => {
    let accounts = [...initialAccounts];
    
    if (filter !== 'all') {
        if (filter === 'debit') {
            accounts = accounts.filter(a => a.balance >= 0);
        } else if (filter === 'credit') {
            accounts = accounts.filter(a => a.balance < 0);
        } else {
            accounts = accounts.filter(a => a.categoryId === filter);
        }
    }

    if (searchTerm) {
      accounts = accounts.filter(account =>
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCategoryName(account.categoryId).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    const [sortField, sortDirection] = sortDescriptor.split('-') as ['name' | 'balance' | 'category' | 'recent', 'asc' | 'desc'];


    accounts.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch(sortField) {
        case 'category':
          aValue = getCategoryName(a.categoryId);
          bValue = getCategoryName(b.categoryId);
          break;
        case 'balance':
          aValue = Math.abs(a.balance);
          bValue = Math.abs(b.balance);
          break;
        case 'recent':
            aValue = a.lastTransactionDate ? new Date(a.lastTransactionDate).getTime() : 0;
            bValue = b.lastTransactionDate ? new Date(b.lastTransactionDate).getTime() : 0;
            break;
        default: // name
          aValue = a.name;
          bValue = b.name;
      }

      if (aValue === null || aValue === 0) aValue = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bValue === null || bValue === 0) bValue = sortDirection === 'asc' ? Infinity : -Infinity;

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return accounts;
  }, [initialAccounts, searchTerm, sortDescriptor, filter, getCategoryName]);

  const handleSelect = (accountId: string, checked: boolean) => {
    if(checked) {
      setSelectedAccounts(prev => [...prev, accountId]);
    } else {
      setSelectedAccounts(prev => prev.filter(id => id !== accountId));
    }
  }
  
  const handleSelectAll = (checked: boolean) => {
    if(checked) {
      setSelectedAccounts(filteredAndSortedAccounts.map(a => a.id));
    } else {
      setSelectedAccounts([]);
    }
  }

  const toggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedAccounts([]);
    }
    setIsSelectMode(!isSelectMode);
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <h1 className="text-3xl font-headline">Accounts</h1>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/"><Scale /></Link>
                </Button>
                 <Button variant="outline" size="icon" asChild>
                    <Link href="/transactions"><ArrowLeftRight /></Link>
                </Button>
                <Button variant="outline" size="icon" asChild>
                    <Link href="/categories"><Folder /></Link>
                </Button>
                <Button variant="outline" size="icon" asChild>
                    <Link href="/settings"><Settings /></Link>
                </Button>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Dialog open={isAddSheetOpen} onOpenChange={setAddSheetOpen}>
              <DialogTrigger asChild>
                 <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-headline text-2xl">Add New Account</DialogTitle>
                </DialogHeader>
                <AddAccountForm categories={categories} onFinished={() => setAddSheetOpen(false)} />
              </DialogContent>
            </Dialog>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-grow flex flex-col md:flex-row gap-4">
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-64 lg:w-80"
                />
                 <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        <SelectItem value="debit">Debit Balance</SelectItem>
                        <SelectItem value="credit">Credit Balance</SelectItem>
                        {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <label className="text-muted-foreground">Sort by:</label>
                <Select value={sortDescriptor} onValueChange={setSortDescriptor}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recent-desc">Recent Activity</SelectItem>
                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                        <SelectItem value="balance-desc">Balance (Highest First)</SelectItem>
                        <SelectItem value="balance-asc">Balance (Lowest First)</SelectItem>
                        <SelectItem value="category-asc">Category</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4 md:p-6">
            <div className="flex items-center gap-4">
                {isSelectMode && selectedAccounts.length > 0 ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete ({selectedAccounts.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {selectedAccounts.length} accounts. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                          {isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                    <CardTitle className="text-lg">All Accounts ({filteredAndSortedAccounts.length} of {initialAccounts.length})</CardTitle>
                )}
            </div>
            <div className="flex items-center gap-4">
                <div className="text-sm hidden md:block">
                    <span className="text-green-600 mr-4">Total Dr: {formatCurrency(totals.debit)}</span>
                    <span className="text-red-600">Total Cr: {formatCurrency(totals.credit)}</span>
                </div>
                <Button variant="outline" size="sm" onClick={toggleSelectMode}>
                  {isSelectMode ? <X className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                  {isSelectMode ? 'Cancel' : 'Select'}
                </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View */}
          <div className="md:hidden">
             {isSelectMode && (
              <div className="flex items-center px-4 py-2 border-b">
                  <Checkbox 
                      checked={selectedAccounts.length === filteredAndSortedAccounts.length && filteredAndSortedAccounts.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      className="mr-4"
                  />
                  <span className="text-sm text-muted-foreground">Select All</span>
              </div>
            )}
             {filteredAndSortedAccounts.map((account) => (
                <div key={account.id} className="flex items-start gap-4 p-4 border-b last:border-b-0" data-state={selectedAccounts.includes(account.id) ? 'selected' : undefined}>
                    {isSelectMode && (
                      <Checkbox 
                          checked={selectedAccounts.includes(account.id)}
                          onCheckedChange={(checked) => handleSelect(account.id, !!checked)}
                          className="mt-1"
                      />
                    )}
                    <div className="flex-1">
                        <Link href={`/accounts/${account.id}`} className="block">
                            <p className="font-semibold text-primary hover:underline">{account.name}</p>
                        </Link>
                        <Badge variant="secondary" className='capitalize text-xs mt-1'>
                            {getCategoryName(account.categoryId)}
                        </Badge>
                        <div className="mt-2">
                             {account.balance >= 0 ? (
                                <p><span className="text-sm text-muted-foreground">Debit: </span><span className="font-semibold text-green-600">{formatCurrency(account.balance)}</span></p>
                            ) : (
                                <p><span className="text-sm text-muted-foreground">Credit: </span><span className="font-semibold text-red-600">{formatCurrency(Math.abs(account.balance))}</span></p>
                            )}
                        </div>
                    </div>
                    <AlertDialog>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleEdit(account)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setOpenBalanceAccount(account)}>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  <span>Open Balance</span>
                              </DropdownMenuItem>
                              <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                  </DropdownMenuItem>
                              </AlertDialogTrigger>
                          </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete this account.
                          You cannot delete an account that has transactions.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                          onClick={() => handleDelete(account.id)}
                          disabled={isPending}
                          className="bg-destructive hover:bg-destructive/90"
                          >
                          {isPending ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                      </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                </div>
            ))}
          </div>

          {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                  <TableHeader>
                      <TableRow>
                          {isSelectMode && (
                            <TableHead className="w-12">
                               <Checkbox 
                                    checked={selectedAccounts.length === filteredAndSortedAccounts.length && filteredAndSortedAccounts.length > 0}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                               />
                            </TableHead>
                          )}
                          <TableHead>Account</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredAndSortedAccounts.map((account) => (
                      <TableRow key={account.id} data-state={selectedAccounts.includes(account.id) ? 'selected' : undefined}>
                          {isSelectMode && (
                            <TableCell>
                               <Checkbox 
                                    checked={selectedAccounts.includes(account.id)}
                                    onCheckedChange={(checked) => handleSelect(account.id, !!checked)}
                               />
                            </TableCell>
                          )}
                          <TableCell className="font-semibold">
                              <Link href={`/accounts/${account.id}`} className="text-primary hover:underline">
                                  {account.name}
                              </Link>
                          </TableCell>
                          <TableCell>
                               <Badge variant="secondary" className='capitalize text-xs'>
                                  {getCategoryName(account.categoryId)}
                              </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                               {account.balance >= 0 ? (
                                  <span className="text-green-600 font-semibold">{formatCurrency(account.balance)}</span>
                              ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                               {account.balance < 0 ? (
                                  <span className="text-red-600 font-semibold">{formatCurrency(Math.abs(account.balance))}</span>
                              ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                             <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                          <MoreVertical className="h-4 w-4" />
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEdit(account)}>
                                          <Edit className="mr-2 h-4 w-4" />
                                          <span>Edit</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setOpenBalanceAccount(account)}>
                                          <ArrowRight className="mr-2 h-4 w-4" />
                                          <span>Open Balance</span>
                                      </DropdownMenuItem>
                                       <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                  <Trash2 className="mr-2 h-4 w-4" />
                                                  <span>Delete</span>
                                              </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This action cannot be undone. This will permanently delete this account.
                                              You cannot delete an account that has transactions.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDelete(account.id)}
                                              disabled={isPending}
                                              className="bg-destructive hover:bg-destructive/90"
                                            >
                                              {isPending ? 'Deleting...' : 'Delete'}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                          </TableCell>
                      </TableRow>
                  ))}
                   {filteredAndSortedAccounts.length === 0 && (
                       <TableRow>
                          <TableCell colSpan={isSelectMode ? 7 : 6} className="h-24 text-center">
                              No accounts found.
                          </TableCell>
                       </TableRow>
                   )}
                  </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
      
      {editingAccount && (
        <Dialog open={!!editingAccount} onOpenChange={(isOpen) => !isOpen && setEditingAccount(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Edit Account</DialogTitle>
            </DialogHeader>
            <EditAccountForm 
              account={editingAccount} 
              categories={categories} 
              onFinished={() => setEditingAccount(null)}
              openingBalanceTransaction={editingAccount.openingBalanceTransaction}
            />
          </DialogContent>
        </Dialog>
      )}

      {openBalanceAccount && (
        <OpenBalanceDialog
          open={!!openBalanceAccount}
          onOpenChange={(isOpen) => !isOpen && setOpenBalanceAccount(null)}
          account={openBalanceAccount}
        />
      )}

    </div>
  );
}