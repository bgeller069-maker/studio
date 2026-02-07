'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBooks } from '@/context/BookContext';
import { getAccountsForBookAction, transferBalanceToBookAction } from '@/app/actions';
import type { Account as AccountType } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { ArrowRightLeft } from 'lucide-react';

type AccountWithBalance = AccountType & { balance: number };

type TransferBalanceDialogProps = {
  account: AccountWithBalance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const NEW_ACCOUNT_VALUE = '__new__';

export default function TransferBalanceDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: TransferBalanceDialogProps) {
  const { activeBook, books } = useBooks();
  const [targetBookId, setTargetBookId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [targetAccounts, setTargetAccounts] = useState<AccountType[]>([]);
  const [loadingTargetAccounts, setLoadingTargetAccounts] = useState(false);
  const [amount, setAmount] = useState('');
  const [isPending, startTransition] = useTransition();

  const balanceType = account.balance >= 0 ? 'debit' : 'credit';
  const defaultAmount = Math.abs(account.balance);

  const otherBooks = books.filter((b) => b.id !== activeBook?.id);

  useEffect(() => {
    if (!open) return;
    setAmount(String(defaultAmount));
    setTargetBookId('');
    setTargetAccountId('');
    setTargetAccounts([]);
  }, [open, defaultAmount]);

  useEffect(() => {
    if (!targetBookId) {
      setTargetAccounts([]);
      setTargetAccountId('');
      return;
    }
    setLoadingTargetAccounts(true);
    getAccountsForBookAction(targetBookId).then((result) => {
      setLoadingTargetAccounts(false);
      if (result.success && result.accounts) {
        setTargetAccounts(result.accounts);
        setTargetAccountId('');
      } else {
        setTargetAccounts([]);
      }
    });
  }, [targetBookId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBook || !targetBookId) return;
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) return;
    if (numAmount > Math.abs(account.balance)) return;

    startTransition(async () => {
      const result = await transferBalanceToBookAction({
        sourceBookId: activeBook.id,
        targetBookId,
        sourceAccountId: account.id,
        sourceAccountName: account.name,
        sourceCategoryId: account.categoryId,
        amount: numAmount,
        balanceType,
        targetAccountId: targetAccountId && targetAccountId !== NEW_ACCOUNT_VALUE ? targetAccountId : undefined,
      });
      if (result.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        console.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer balance to another book
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{account.name}</p>
            <p className="text-muted-foreground">
              Current balance: {account.balance >= 0 ? 'Dr' : 'Cr'} {formatCurrency(Math.abs(account.balance))}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount to transfer</Label>
            <Input
              id="amount"
              type="number"
              min={0.01}
              step="any"
              max={Math.abs(account.balance)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Max: {formatCurrency(Math.abs(account.balance))}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Target book</Label>
            <Select value={targetBookId} onValueChange={setTargetBookId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a book" />
              </SelectTrigger>
              <SelectContent>
                {otherBooks.map((book) => (
                  <SelectItem key={book.id} value={book.id}>
                    {book.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetBookId && (
            <div className="space-y-2">
              <Label>Target account</Label>
              <Select
                value={targetAccountId}
                onValueChange={setTargetAccountId}
                disabled={loadingTargetAccounts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingTargetAccounts ? 'Loading…' : 'Select or create'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_ACCOUNT_VALUE}>
                    Create new account &quot;{account.name}&quot;
                  </SelectItem>
                  {targetAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !targetBookId}>
              {isPending ? 'Transferring…' : 'Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
