'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBooks } from '@/context/BookContext';
import { transferOpeningBalanceAction } from '@/app/actions';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Account } from '@/lib/types';

type OpenBalanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account & { balance: number };
};

export default function OpenBalanceDialog({ open, onOpenChange, account }: OpenBalanceDialogProps) {
  const { books, activeBook } = useBooks();
  const [targetBookId, setTargetBookId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Filter out the current active book
  const availableBooks = books.filter(book => book.id !== activeBook?.id);

  // Initialize amount with account balance when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setAmount(Math.abs(account.balance).toString());
      setTargetBookId('');
    } else {
      setAmount('');
      setTargetBookId('');
    }
    onOpenChange(isOpen);
  };

  const handleTransfer = () => {
    if (!targetBookId || !amount || !activeBook) {
      toast({
        title: 'Error',
        description: 'Please select a target book and enter an amount.',
        variant: 'destructive',
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid positive amount.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await transferOpeningBalanceAction({
        sourceBookId: activeBook.id,
        targetBookId,
        accountId: account.id,
        accountName: account.name,
        categoryId: account.categoryId,
        amount: amountNum,
        balanceType: account.balance >= 0 ? 'debit' : 'credit',
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: `Opening balance transferred to ${books.find(b => b.id === targetBookId)?.name || 'target book'}.`,
        });
        handleOpenChange(false);
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to transfer opening balance.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Opening Balance</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Account</Label>
            <div className="text-sm font-medium">{account.name}</div>
            <div className="text-sm text-muted-foreground">
              Current Balance: {account.balance >= 0 ? (
                <span className="text-green-600">Dr. {formatCurrency(account.balance)}</span>
              ) : (
                <span className="text-red-600">Cr. {formatCurrency(Math.abs(account.balance))}</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-book">Transfer To Book</Label>
            <Select value={targetBookId} onValueChange={setTargetBookId}>
              <SelectTrigger id="target-book">
                <SelectValue placeholder="Select a book" />
              </SelectTrigger>
              <SelectContent>
                {availableBooks.map(book => (
                  <SelectItem key={book.id} value={book.id}>
                    {book.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
            <p className="text-xs text-muted-foreground">
              This will create an opening balance transaction in the target book with today&apos;s date.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={isPending || !targetBookId || !amount}>
            {isPending ? 'Transferring...' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

