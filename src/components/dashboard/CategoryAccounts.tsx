
'use client';

import type { Account, Category } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


type AccountWithBalance = Account & { balance: number };

type CategoryAccountsProps = {
  categoryName: string;
  accounts: AccountWithBalance[];
  categories: Category[];
  selectedCategoryId?: string;
  onCategoryChange: (id: string) => void;
};

export default function CategoryAccounts({ categoryName, accounts, categories, selectedCategoryId, onCategoryChange }: CategoryAccountsProps) {

  if (!accounts) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                     <Select onValueChange={onCategoryChange} defaultValue={selectedCategoryId}>
                        <SelectTrigger className="border-none !bg-transparent p-0 h-auto focus:ring-0 focus:ring-offset-0 w-auto text-2xl font-semibold leading-none tracking-tight">
                            <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                            {category.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </CardTitle>
            </CardHeader>
             <CardContent>
                <p className="text-muted-foreground">No accounts with balances found in this category.</p>
            </CardContent>
        </Card>
    );
  }
  
  const totalDebit = accounts.filter(a => a.balance >= 0).reduce((sum, a) => sum + a.balance, 0);
  const totalCredit = accounts.filter(a => a.balance < 0).reduce((sum, a) => sum + Math.abs(a.balance), 0);


  return (
    <Card>
      <CardHeader>
        <CardTitle>
            <Select onValueChange={onCategoryChange} defaultValue={selectedCategoryId}>
                <SelectTrigger className="border-none !bg-transparent p-0 h-auto focus:ring-0 focus:ring-offset-0 w-auto text-2xl font-semibold leading-none tracking-tight">
                    <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                    {category.name}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-auto py-2">Account Name</TableHead>
              <TableHead className="text-right h-auto py-2">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const isDebit = account.balance >= 0;
              return (
              <TableRow key={account.id}>
                <TableCell className="py-2">
                  <Link href={`/accounts/${account.id}`} className="font-medium text-primary hover:underline">
                    {account.name}
                  </Link>
                </TableCell>
                <TableCell className={cn(
                    "text-right py-2 font-semibold",
                    isDebit ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(Math.abs(account.balance))}
                  <span className="text-xs text-muted-foreground ml-1">{isDebit ? 'Dr' : 'Cr'}</span>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="justify-end gap-4 text-sm border-t pt-4">
        <div className="font-semibold">
            <span className="text-muted-foreground mr-2">Total Debit:</span>
            <span className="text-green-600">{formatCurrency(totalDebit)}</span>
        </div>
        <div className="font-semibold">
            <span className="text-muted-foreground mr-2">Total Credit:</span>
            <span className="text-red-600">{formatCurrency(totalCredit)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
