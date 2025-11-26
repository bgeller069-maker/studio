
'use client';

import type { Account, Category } from '@/lib/types';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, MoreVertical, PlusCircle, Trash2, Home, Users, List, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { deleteCategoryAction, updateCategoryAction, createCategoryAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useBooks } from '@/context/BookContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type AccountWithBalance = Account & { balance: number };
type CategoryWithDetails = Category & {
  accounts: AccountWithBalance[];
  totalBalance: number;
};

type CategoriesClientProps = {
  categories: CategoryWithDetails[];
  allCategories: Category[];
};

const categoryColors = [
  'bg-green-100 border-green-200 dark:bg-green-900/20 dark:border-green-800/30',
  'bg-gray-100 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800/30',
  'bg-red-100 border-red-200 dark:bg-red-900/20 dark:border-red-800/30',
  'bg-yellow-100 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/30',
  'bg-violet-100 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800/30',
  'bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/30',
];

// Define which categories normally have a debit balance
const DEBIT_BALANCE_CATEGORY_NAMES = ['asset', 'expense', 'parties', 'cash', 'gold and silver', 'vc', 'other', 'rr'];

const isDebitCategory = (categoryName: string) => {
    const lowerCategoryName = categoryName.toLowerCase();
    return DEBIT_BALANCE_CATEGORY_NAMES.some(debitCat => lowerCategoryName.includes(debitCat));
};


export default function CategoriesClient({ categories, allCategories }: CategoriesClientProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { activeBook } = useBooks();
  
  const [editingCategory, setEditingCategory] = useState<CategoryWithDetails | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');


  const handleDelete = (categoryId: string) => {
    if (!activeBook) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(activeBook.id, categoryId);
      if (result.success) {
        toast({ title: "Success", description: result.message });
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };

  const handleEditOpen = (category: CategoryWithDetails) => {
    setEditingCategory(category);
    setEditingCategoryName(category.name);
  };
  
  const handleUpdateCategory = () => {
    if (!editingCategory || !activeBook) return;
    startTransition(async () => {
        const result = await updateCategoryAction(activeBook.id, editingCategory.id, editingCategoryName);
         if (result.success) {
            toast({ title: "Success", description: result.message });
            setEditingCategory(null);
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    });
  };

  const handleAddCategory = () => {
    if (!activeBook) return;
    startTransition(async () => {
      const result = await createCategoryAction(activeBook.id, newCategoryName);
      if (result.success) {
        setNewCategoryName("");
        setIsAddDialogOpen(false);
        toast({ title: "Success", description: result.message });
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };


  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <h1 className="text-3xl font-headline">Categories</h1>
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
                <Button variant="outline" size="icon" asChild>
                    <Link href="/settings"><Settings /></Link>
                </Button>
            </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Category
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                <DialogTitle className="font-headline text-2xl">Add New Category</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-right">
                    Category Name
                    </Label>
                    <Input
                    id="name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Long-term Assets"
                    />
                </div>
                </div>
                <DialogFooter>
                <Button onClick={handleAddCategory} disabled={isPending || !newCategoryName.trim()}>
                    {isPending ? "Adding..." : "Add Category"}
                </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="md:columns-2 gap-6 space-y-6">
        {categories.map((category, index) => {
          const normallyDebit = isDebitCategory(category.name);
          // The raw totalBalance is Debit - Credit.
          // If it's a "normally debit" category, a positive balance is debit.
          // If it's a "normally credit" category, a negative balance is credit.
          const totalIsDebit = normallyDebit ? category.totalBalance >= 0 : category.totalBalance < 0;

          return (
          <Card key={category.id} className={cn("break-inside-avoid-column", categoryColors[index % categoryColors.length])}>
            <CardHeader className="flex flex-row justify-between items-start">
              <div>
                <CardTitle className="font-bold text-lg">{category.name}</CardTitle>
                <CardDescription className="text-sm">
                  {category.accounts.length} accounts &bull; Total: {formatCurrency(Math.abs(category.totalBalance))}
                   <span className="text-xs ml-1">{totalIsDebit ? 'Dr' : 'Cr'}</span>
                </CardDescription>
              </div>
               <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleEditOpen(category)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Category
                        </DropdownMenuItem>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Category
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete this category. You cannot delete a category that has accounts assigned to it.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => handleDelete(category.id)}
                                        disabled={isPending || category.accounts.length > 0}
                                        className="bg-destructive hover:bg-destructive/90"
                                    >
                                        {isPending ? 'Deleting...' : 'Delete'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent>
              {category.accounts.length > 0 ? (
                <ul className="space-y-2">
                  {category.accounts.map((account) => {
                    // Raw balance is Debit - Credit
                    // If it's a "normally debit" category, a positive balance is a debit balance.
                    // If it's a "normally credit" category, a negative balance is a credit balance.
                    const isDebit = normallyDebit ? account.balance >= 0 : account.balance < 0;
                    return (
                     <li key={account.id} className="flex justify-between items-center bg-background/50 p-3 rounded-md">
                        <Link href={`/accounts/${account.id}`} className="font-medium hover:underline">
                            {account.name}
                        </Link>
                        <span className={cn("font-semibold text-sm", isDebit ? 'text-green-700' : 'text-red-700')}>
                          {formatCurrency(Math.abs(account.balance))}
                          <span className="text-xs text-muted-foreground ml-1">{isDebit ? 'Dr' : 'Cr'}</span>
                        </span>
                    </li>
                  )})}
                </ul>
              ) : (
                <div className="flex items-center justify-center text-center">
                    <p className="text-sm text-muted-foreground p-4">
                        No accounts in this category.
                    </p>
                </div>
              )}
            </CardContent>
          </Card>
        )})}
      </div>
       <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Category Name</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-4">
                <Label htmlFor="category-name">Category Name</Label>
                <Input id="category-name" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
                <Button onClick={handleUpdateCategory} disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
