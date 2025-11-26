
'use client';

import type { Account, Category, Transaction } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn, formatDate } from '@/lib/utils';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { ArrowUpDown, Pencil, Trash2, ArrowRight, PlusCircle, ArrowLeftRight, Calendar as CalendarIcon, Scale, Users, MoreVertical, Folder, Settings, CheckSquare, X, Paintbrush, Strikethrough } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import { useTransition, useState, useMemo, useEffect } from 'react';
import { deleteTransactionAction, updateTransactionHighlightAction, deleteMultipleTransactionsAction } from '@/app/actions';
import { Input } from '../ui/input';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddTransactionForm from '@/components/transactions/AddTransactionForm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from '../ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, subDays, startOfWeek, endOfMonth, startOfMonth, endOfWeek } from 'date-fns';
import { useBooks } from '@/context/BookContext';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';


type RecentTransactionsProps = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
};

type TransactionView = 'to_from' | 'dr_cr';
type HighlightColor = 'yellow' | 'blue' | 'strikethrough';
type DateRangePreset = 'all' | 'this_week' | 'this_month' | 'last_30_days' | 'last_90_days' | 'custom';

const highlightClasses: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-100/70 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/40',
  blue: 'bg-blue-100/70 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40',
  strikethrough: 'line-through text-muted-foreground bg-muted/50 dark:bg-muted/30 hover:bg-muted/60',
};


export default function RecentTransactions({ transactions: initialTransactions, accounts, categories }: RecentTransactionsProps) {
  const getAccountName = (accountId: string) => accounts.find(a => a.id === accountId)?.name || 'Unknown Account';
  const pathname = usePathname();
  const isTransactionsPage = pathname === '/transactions';

  const [isPending, startTransition] = useTransition();
  const [highlightingTransactionId, setHighlightingTransactionId] = useState<string | null>(null);
  const { activeBook } = useBooks();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortDescriptor, setSortDescriptor] = useState('date-desc');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [transactionView, setTransactionView] = useState<TransactionView>('to_from');
  const [isMounted, setIsMounted] = useState(false);

  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (activeBook) {
      const storedView = localStorage.getItem(`transactionView_${activeBook.id}`) as TransactionView | null;
      if (storedView) {
        setTransactionView(storedView);
      }
    }
    setIsMounted(true);
  }, [activeBook]);

  const handleDelete = (transactionId: string) => {
    if (!activeBook) return;
    startTransition(async () => {
      const result = await deleteTransactionAction(activeBook.id, transactionId);
      if (!result.success) {
        console.error(result.message);
      }
    });
  };

  const handleBulkDelete = () => {
    if (!activeBook || selectedTransactions.length === 0) return;
    startTransition(async () => {
        const result = await deleteMultipleTransactionsAction(activeBook.id, selectedTransactions);
        if(result.success) {
            setSelectedTransactions([]);
            setIsSelectMode(false);
        } else {
            console.error(result.message);
        }
    });
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsSheetOpen(true);
  };

  const handleAdd = () => {
    setEditingTransaction(null);
    setIsSheetOpen(true);
  }
  
  const onSheetFinished = () => {
    setIsSheetOpen(false);
    setEditingTransaction(null);
  }

  const handleHighlight = (transactionId: string, color: HighlightColor, currentColor?: HighlightColor | null) => {
    if (!activeBook) return;

    startTransition(async () => {
        setHighlightingTransactionId(transactionId);
        const newHighlight = currentColor === color ? null : color;
        await updateTransactionHighlightAction(activeBook.id, transactionId, newHighlight);
        setHighlightingTransactionId(null);
    });
  };
  
  const handleDatePresetChange = (value: DateRangePreset) => {
    setDateRangePreset(value);
    if (value !== 'custom') {
      setCustomDateRange(undefined);
    }
  }

  const { transactions, openingBalanceTransactions } = useMemo(() => {
    const regular: Transaction[] = [];
    const opening: Transaction[] = [];

    initialTransactions.forEach(tx => {
      if (tx.description.startsWith('Opening Balance for')) {
        opening.push(tx);
      } else {
        regular.push(tx);
      }
    });
    
    let filtered = [...regular];

    if (isTransactionsPage) {
        if (searchTerm) {
          const lowercasedFilter = searchTerm.toLowerCase();
          filtered = filtered.filter(tx => {
            const amount = tx.entries.find(e => e.type === 'debit')?.amount || 0;
            return (
              tx.description.toLowerCase().includes(lowercasedFilter) ||
              tx.entries.some(entry =>
                getAccountName(entry.accountId).toLowerCase().includes(lowercasedFilter) ||
                (entry.description && entry.description.toLowerCase().includes(lowercasedFilter))
              ) ||
              amount.toString().includes(lowercasedFilter)
            );
          });
        }

        let dateFilterRange: DateRange | undefined = customDateRange;
        if (dateRangePreset !== 'custom' && dateRangePreset !== 'all') {
            const today = new Date();
            switch (dateRangePreset) {
                case 'this_week':
                    dateFilterRange = { from: startOfWeek(today), to: endOfWeek(today) };
                    break;
                case 'this_month':
                    dateFilterRange = { from: startOfMonth(today), to: endOfMonth(today) };
                    break;
                case 'last_30_days':
                    dateFilterRange = { from: subDays(today, 30), to: today };
                    break;
                case 'last_90_days':
                    dateFilterRange = { from: subDays(today, 90), to: today };
                    break;
            }
        }
        
        if (dateFilterRange?.from) {
             const from = dateFilterRange.from;
             const to = dateFilterRange.to || new Date(); 
             
             filtered = filtered.filter(tx => {
                 const txDate = new Date(tx.date);
                 return txDate >= from && txDate <= to;
             });
        }
    }
    
    const [sortField, sortDirection] = sortDescriptor.split('-') as ['date' | 'amount' | 'description', 'asc' | 'desc'];

    const sorted = filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'date') {
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
      } else if (sortField === 'amount') {
        aValue = a.entries.find(e => e.type === 'debit')?.amount || 0;
        bValue = b.entries.find(e => e.type === 'debit')?.amount || 0;
      } else { // description
        aValue = a.description;
        bValue = b.description;
      }
      
      if (typeof aValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    if (!isTransactionsPage) {
        return { transactions: sorted.slice(0, 5), openingBalanceTransactions: [] };
    }
    return { transactions: sorted, openingBalanceTransactions: opening };
  }, [initialTransactions, isTransactionsPage, searchTerm, sortDescriptor, dateRangePreset, customDateRange]);

  const handleSelect = (transactionId: string, checked: boolean) => {
    if(checked) {
      setSelectedTransactions(prev => [...prev, transactionId]);
    } else {
      setSelectedTransactions(prev => prev.filter(id => id !== transactionId));
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if(checked) {
      setSelectedTransactions(transactions.map(t => t.id));
    } else {
      setSelectedTransactions([]);
    }
  }
  
  const toggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedTransactions([]);
    }
    setIsSelectMode(!isSelectMode);
  }

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-headline">Transactions</h1>
        <Card>
          <CardContent className="p-6">
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <>
    {isTransactionsPage && (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <h1 className="text-2xl font-headline">Transactions</h1>
              <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" asChild>
                      <Link href="/"><Scale /></Link>
                  </Button>
                   <Button variant="outline" size="icon" asChild>
                      <Link href="/accounts"><Users /></Link>
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                      <Link href="/categories"><Folder /></Link>
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                      <Link href="/settings"><Settings /></Link>
                  </Button>
              </div>
          </div>
          <Button onClick={handleAdd}>
              <PlusCircle className="mr-2 h-4 w-4" />
              ADD NEW
          </Button>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                placeholder="Search anything..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-auto"
              />
              <Select value={sortDescriptor} onValueChange={setSortDescriptor}>
              <SelectTrigger className="w-full flex-1 md:w-[180px]">
                  <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="date-desc">Most Recent</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="amount-desc">Highest Amount</SelectItem>
                  <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                  <SelectItem value="description-asc">Narration (A-Z)</SelectItem>
              </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Select value={dateRangePreset} onValueChange={handleDatePresetChange}>
                <SelectTrigger className="w-full flex-1 md:w-[180px]">
                    <SelectValue placeholder="Select a date range" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
                </Select>
                 {dateRangePreset === 'custom' && (
                  <Popover>
                      <PopoverTrigger asChild>
                      <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                          "w-full justify-start text-left font-normal",
                          !customDateRange && "text-muted-foreground"
                          )}
                      >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange?.from ? (
                          customDateRange.to ? (
                              <>
                              {format(customDateRange.from, "dd/MM/yyyy")} -{" "}
                              {format(customDateRange.to, "dd/MM/yyyy")}
                              </>
                          ) : (
                              format(customDateRange.from, "dd/MM/yyyy")
                          )
                          ) : (
                          <span>Pick a date</span>
                          )}
                      </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={customDateRange?.from}
                          selected={customDateRange}
                          onSelect={setCustomDateRange}
                          numberOfMonths={2}
                      />
                      </PopoverContent>
                  </Popover>
              )}
            </div>
          </div>
      </div>
    )}
    <Card>
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          {isSelectMode && selectedTransactions.length > 0 && isTransactionsPage ? (
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete ({selectedTransactions.length})
                  </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                      This will permanently delete {selectedTransactions.length} transactions. This action cannot be undone.
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
            <>
             <CardTitle className={cn(!isTransactionsPage && "text-2xl font-headline")}>Transactions</CardTitle>
             {!isTransactionsPage && <CardDescription>A quick look at your latest financial activities.</CardDescription>}
            </>
          )}
        </div>
        {isTransactionsPage && (
          <Button variant="outline" size="sm" onClick={toggleSelectMode}>
            {isSelectMode ? <X className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
            {isSelectMode ? 'Cancel' : 'Select'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
      {transactions.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">No transactions match your criteria.</p>
        </div>
      ) : (
        <>
         {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {transactions.map(tx => {
              const rowClass = tx.highlight ? highlightClasses[tx.highlight] : '';

              return (
              <Card key={tx.id} className={cn('w-full', rowClass)}>
                <CardContent className="p-4 flex gap-3">
                  {isSelectMode && isTransactionsPage && (
                    <Checkbox
                        checked={selectedTransactions.includes(tx.id)}
                        onCheckedChange={(checked) => handleSelect(tx.id, !!checked)}
                        className="mt-1"
                    />
                  )}
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                            <p className="font-semibold">{tx.description}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(tx.date)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <p className="font-semibold text-lg">{formatCurrency(tx.entries.find(e => e.type === 'debit')?.amount || 0)}</p>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(tx)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger><Paintbrush className="mr-2 h-4 w-4"/> Highlight</DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent>
                                                 <DropdownMenuItem onClick={() => handleHighlight(tx.id, 'yellow', tx.highlight)} className={cn(tx.highlight === 'yellow' && 'bg-yellow-100')}>
                                                    <div className="w-4 h-4 rounded-full bg-yellow-400 mr-2"/> Yellow
                                                 </DropdownMenuItem>
                                                 <DropdownMenuItem onClick={() => handleHighlight(tx.id, 'blue', tx.highlight)} className={cn(tx.highlight === 'blue' && 'bg-blue-100')}>
                                                    <div className="w-4 h-4 rounded-full bg-blue-400 mr-2"/> Blue
                                                 </DropdownMenuItem>
                                                 <DropdownMenuItem onClick={() => handleHighlight(tx.id, 'strikethrough', tx.highlight)} className={cn(tx.highlight === 'strikethrough' && 'bg-gray-200')}>
                                                     <Strikethrough className="mr-2 h-4 w-4"/> Strikethrough
                                                 </DropdownMenuItem>
                                                  {tx.highlight && (
                                                      <DropdownMenuItem onClick={() => handleHighlight(tx.id, tx.highlight, tx.highlight)}>
                                                          <X className="mr-2 h-4 w-4" /> Clear
                                                      </DropdownMenuItem>
                                                  )}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete this transaction.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleDelete(tx.id)}
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
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <p><span className="text-green-600 font-semibold">{transactionView === 'dr_cr' ? 'Dr:' : 'To:'}</span> {tx.entries.filter(e => e.type === 'debit').map(e => getAccountName(e.accountId)).join(', ')}</p>
                        <p><span className="text-red-600 font-semibold">{transactionView === 'dr_cr' ? 'Cr:' : 'From:'}</span> {tx.entries.filter(e => e.type === 'credit').map(e => getAccountName(e.accountId)).join(', ')}</p>
                    </div>
                   </div>
                </CardContent>
              </Card>
            )})}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                   {isTransactionsPage && isSelectMode && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTransactions.length === transactions.length && transactions.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                    </TableHead>
                  )}
                  <TableHead>
                     Date
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">
                        Amount
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(tx => {
                   const rowClass = tx.highlight ? highlightClasses[tx.highlight] : '';
                   const isHighlightingCurrent = highlightingTransactionId === tx.id;

                  return (
                  <TableRow key={tx.id} className={cn(rowClass)} data-state={selectedTransactions.includes(tx.id) ? 'selected' : undefined}>
                    {isTransactionsPage && isSelectMode && (
                      <TableCell>
                        <Checkbox
                          checked={selectedTransactions.includes(tx.id)}
                          onCheckedChange={(checked) => handleSelect(tx.id, !!checked)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="w-28">{formatDate(tx.date)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="text-green-600 font-semibold">{transactionView === 'dr_cr' ? 'Dr:' : 'To:'}</span> {tx.entries.filter(e => e.type === 'debit').map(e => getAccountName(e.accountId)).join(', ')}
                        <span className="text-red-600 font-semibold mx-2">{transactionView === 'dr_cr' ? 'Cr:' : 'From:'}</span> {tx.entries.filter(e => e.type === 'credit').map(e => getAccountName(e.accountId)).join(', ')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.entries.find(e => e.type === 'debit')?.amount || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1" style={{ opacity: isHighlightingCurrent ? 0.5 : 1 }}>
                        <Button
                            variant="outline"
                            size="icon"
                            className={cn("h-6 w-6 border-yellow-400 text-yellow-500", tx.highlight === 'yellow' && 'bg-yellow-200')}
                            onClick={() => handleHighlight(tx.id, 'yellow', tx.highlight)}
                            disabled={isHighlightingCurrent}
                        >
                            <span className="font-bold text-xs">1</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className={cn("h-6 w-6 border-blue-400 text-blue-500", tx.highlight === 'blue' && 'bg-blue-200')}
                            onClick={() => handleHighlight(tx.id, 'blue', tx.highlight)}
                            disabled={isHighlightingCurrent}
                        >
                            <span className="font-bold text-xs">2</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className={cn("h-6 w-6", tx.highlight === 'strikethrough' && 'bg-muted text-foreground')}
                            onClick={() => handleHighlight(tx.id, 'strikethrough', tx.highlight)}
                            disabled={isHighlightingCurrent}
                        >
                            <Strikethrough className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" disabled={isHighlightingCurrent}>
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">More actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => handleEdit(tx)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>Edit</span>
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
                                      This action cannot be undone. This will permanently delete this transaction.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(tx.id)}
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
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      </CardContent>
       {!isTransactionsPage && transactions.length > 0 && (
        <CardFooter className="justify-center border-t p-4">
            <Button asChild variant="ghost" size="sm">
                <Link href="/transactions">
                View All Transactions <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </CardFooter>
      )}
    </Card>

    {isTransactionsPage && openingBalanceTransactions.length > 0 && (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Opening Balance Entries</CardTitle>
                <CardDescription>These are initial balance transactions created automatically for your accounts.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Type</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {openingBalanceTransactions.map(tx => {
                            const mainEntry = tx.entries.find(e => !e.accountId.startsWith('acc_opening_balance_equity_'));
                            if (!mainEntry) return null;

                            return (
                                <TableRow key={tx.id}>
                                    <TableCell>{formatDate(tx.date)}</TableCell>
                                    <TableCell className="font-medium">{getAccountName(mainEntry.accountId)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(mainEntry.amount)}</TableCell>
                                    <TableCell>
                                        <Badge variant={mainEntry.type === 'debit' ? 'outline' : 'secondary'} className={cn(
                                            mainEntry.type === 'debit' ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'
                                        )}>
                                            {mainEntry.type === 'debit' ? 'Dr' : 'Cr'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )}


    <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="sm:max-w-3xl w-full overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
          </DialogHeader>
            <AddTransactionForm
              accounts={accounts}
              categories={categories}
              onFinished={onSheetFinished}
              initialData={editingTransaction}
              bookId={activeBook?.id || ''}
            />
        </DialogContent>
    </Dialog>
    </>
  );
}
