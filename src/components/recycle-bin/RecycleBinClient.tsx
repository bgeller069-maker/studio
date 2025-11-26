'use client';

import { useState, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Book, Folder, RotateCcw, Trash2, Home, Users, List } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { restoreItemAction, deletePermanentlyAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Category, Transaction, Account } from '@/lib/types';


type RecycledItem = {
  type: 'transaction' | 'account' | 'category' | 'book';
  deletedAt: string;
  id: string;
  [key: string]: any;
};

type RecycleBinClientProps = {
  initialItems: RecycledItem[];
};

const iconMap = {
  transaction: <List className="h-5 w-5" />,
  account: <Users className="h-5 w-5" />,
  category: <Folder className="h-5 w-5" />,
  book: <Book className="h-5 w-5" />,
};

const getTitle = (item: RecycledItem) => {
  switch (item.type) {
    case 'transaction':
      return item.description;
    case 'account':
    case 'category':
    case 'book':
      return item.name;
    default:
      return 'Unknown Item';
  }
};

const ItemDetails = ({ item }: { item: RecycledItem }) => {
    let details: React.ReactNode = null;

    switch (item.type) {
        case 'transaction':
            const amount = (item as Transaction).entries.find(e => e.type === 'debit')?.amount || 0;
            details = (
                <span className="text-sm text-muted-foreground">
                    Amount: <span className="font-semibold text-foreground">{formatCurrency(amount)}</span>
                </span>
            );
            break;
        case 'account':
             if (item.categoryName) {
                details = (
                    <span className="text-sm text-muted-foreground">
                        Category: <span className="font-semibold text-foreground">{item.categoryName}</span>
                    </span>
                );
            }
            break;
        default:
            break;
    }

    return (
        <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted-foreground">
                Deleted: {formatDate(item.deletedAt)}
            </p>
            {details}
        </div>
    );
}

export default function RecycleBinClient({ initialItems: rawItems }: RecycleBinClientProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDescriptor, setSortDescriptor] = useState('deletedAt-desc');

  const getItemKey = (item: RecycledItem) => `${item.type}-${item.id}-${item.deletedAt}`;
  
  // A bit of a hack to get category names for deleted accounts
  const allCategories = useMemo(() => {
    const categories: Category[] = [];
    rawItems.forEach(item => {
      if (item.type === 'category') {
        categories.push(item as Category);
      }
    });
    return categories;
  }, [rawItems]);

  const initialItems = useMemo(() => {
    return rawItems.map(item => {
      if (item.type === 'account') {
        const category = allCategories.find(c => c.id === (item as Account).categoryId);
        return { ...item, categoryName: category?.name || 'Unknown' };
      }
      return item;
    })
  }, [rawItems, allCategories]);


  const filteredAndSortedItems = useMemo(() => {
    let items = [...initialItems];

    if (searchTerm) {
      items = items.filter(item =>
        getTitle(item).toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const [sortField, sortDirection] = sortDescriptor.split('-');

    items.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'title':
          aValue = getTitle(a);
          bValue = getTitle(b);
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default: // deletedAt
          aValue = new Date(a.deletedAt).getTime();
          bValue = new Date(b.deletedAt).getTime();
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return items;
  }, [initialItems, searchTerm, sortDescriptor]);

  const handleSelect = (itemKey: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemKey]);
    } else {
      setSelectedItems(prev => prev.filter(key => key !== itemKey));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredAndSortedItems.map(getItemKey));
    } else {
      setSelectedItems([]);
    }
  };
  
  const handleAction = async (action: 'restore' | 'delete', itemsToProcess: RecycledItem[]) => {
      startTransition(async () => {
          const results = await Promise.all(itemsToProcess.map(item => 
              action === 'restore' ? restoreItemAction(item) : deletePermanentlyAction(item)
          ));

          const successes = results.filter(r => r.success).length;
          const failures = results.length - successes;

          if (successes > 0) {
              toast({
                  title: 'Success',
                  description: `${successes} item(s) ${action === 'restore' ? 'restored' : 'deleted'}.`,
              });
          }
          if (failures > 0) {
              toast({
                  title: 'Error',
                  description: `Failed to ${action} ${failures} item(s). See console for details.`,
                  variant: 'destructive',
              });
              results.filter(r => !r.success).forEach(r => console.error(r.message));
          }
          
          setSelectedItems([]);
      });
  };

  const itemsByKey = useMemo(() => Object.fromEntries(initialItems.map(item => [getItemKey(item), item])), [initialItems]);
  const getSelectedItems = () => selectedItems.map(key => itemsByKey[key]).filter(Boolean);


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <h1 className="text-3xl font-headline">Recycle Bin</h1>
             <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/"><Home /></Link>
                </Button>
                 <Button variant="outline" size="icon" asChild>
                    <Link href="/accounts"><Users /></Link>
                </Button>
                 <Button variant="outline" size="icon" asChild>
                    <Link href="/transactions"><List /></Link>
                </Button>
            </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </div>
      
       <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <Input
                placeholder="Search by name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 lg:w-80"
            />
            <Select value={sortDescriptor} onValueChange={setSortDescriptor}>
                <SelectTrigger className="w-full md:w-[220px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="deletedAt-desc">Deleted: Newest First</SelectItem>
                    <SelectItem value="deletedAt-asc">Deleted: Oldest First</SelectItem>
                    <SelectItem value="title-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="title-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="type-asc">Type (A-Z)</SelectItem>
                </SelectContent>
            </Select>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="flex-row items-center justify-between">
           <div>
            <CardTitle>Deleted Items ({filteredAndSortedItems.length})</CardTitle>
            <CardDescription>
                Items deleted in the last 30 days are shown here.
            </CardDescription>
           </div>
           {selectedItems.length > 0 && (
               <div className="flex items-center gap-2">
                   <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="outline"><RotateCcw className="mr-2 h-4 w-4"/> Restore ({selectedItems.length})</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Restore Selected Items?</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to restore {selectedItems.length} item(s)?</AlertDialogDescription>
                          </AlertDialogHeader>
                           <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleAction('restore', getSelectedItems())} disabled={isPending}>
                                    {isPending ? 'Restoring...' : 'Restore'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                      </AlertDialogContent>
                   </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete ({selectedItems.length})</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Permanently Delete Items?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone. This will permanently delete {selectedItems.length} item(s).</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleAction('delete', getSelectedItems())} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                                    {isPending ? 'Deleting...' : 'Delete Permanently'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                      </AlertDialogContent>
                   </AlertDialog>
               </div>
           )}
        </CardHeader>
        <CardContent>
          {initialItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48">
              <Trash2 className="h-12 w-12 mb-4" />
              <p>The recycle bin is empty.</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh] border rounded-md">
              <div className="flex items-center border-b p-4">
                 <Checkbox 
                    id="select-all"
                    checked={selectedItems.length === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    className="mr-4"
                />
                <label htmlFor="select-all" className="text-sm font-medium">Select All ({selectedItems.length} selected)</label>
              </div>
              
              {filteredAndSortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48">
                    <p>No items match your search.</p>
                </div>
              ) : (
                <ul className="divide-y">
                    {filteredAndSortedItems.map((item) => {
                      const itemKey = getItemKey(item);
                      return (
                        <li key={itemKey} className="flex items-center justify-between p-4 data-[state=selected]:bg-muted/50" data-state={selectedItems.includes(itemKey) ? 'selected' : 'unselected'}>
                            <div className="flex items-start gap-4">
                            <Checkbox 
                                    checked={selectedItems.includes(itemKey)}
                                    onCheckedChange={(checked) => handleSelect(itemKey, !!checked)}
                                    className="mt-1"
                                />
                            <div className="text-muted-foreground mt-1">{iconMap[item.type]}</div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold">{getTitle(item)}</p>
                                    <Badge variant="secondary" className="capitalize">{item.type}</Badge>
                                </div>
                                <ItemDetails item={item} />
                            </div>
                            </div>
                            <div className="flex items-center gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><RotateCcw className="mr-2 h-4 w-4" /> Restore</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Restore this item?</AlertDialogTitle>
                                        <AlertDialogDescription>Are you sure you want to restore this {item.type}?</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleAction('restore', [item])} disabled={isPending}>{isPending ? 'Restoring...' : 'Restore'}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                                <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Permanently delete this item?</AlertDialogTitle>
                                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleAction('delete', [item])} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>{isPending ? 'Deleting...' : 'Delete Permanently'}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
