
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Account, Category, Transaction } from '@/lib/types';
import { useTransition } from 'react';
import { updateAccountAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useBooks } from '@/context/BookContext';

const formSchema = z.object({
  name: z.string().min(1, 'Account name is required.').max(100),
  categoryId: z.string().min(1, 'Category is required.'),
  openingBalance: z.coerce.number().min(0, "Opening balance can't be negative.").default(0).optional(),
  openingBalanceType: z.enum(['debit', 'credit']).default('debit').optional(),
});


type EditAccountFormProps = {
  account: Account;
  categories: Category[];
  onFinished: () => void;
  openingBalanceTransaction?: Transaction | null;
};

export default function EditAccountForm({ account, categories, onFinished, openingBalanceTransaction }: EditAccountFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { activeBook } = useBooks();

  const openingBalanceEntry = openingBalanceTransaction?.entries.find(e => e.accountId === account.id);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: account.name,
      categoryId: account.categoryId,
      openingBalance: openingBalanceEntry?.amount || 0,
      openingBalanceType: openingBalanceEntry?.type || 'debit',
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!activeBook) return;
    startTransition(async () => {
      const result = await updateAccountAction(activeBook.id, account.id, values);
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        onFinished();
      } else {
        if (result.message?.toLowerCase().includes('already exists')) {
          form.setError('name', { type: 'manual', message: result.message });
        } else {
          toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
          });
        }
      }
    });
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Savings Account" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="openingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Balance</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <div>
                 <FormField
                  control={form.control}
                  name="openingBalanceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="debit">Dr</SelectItem>
                            <SelectItem value="credit">Cr</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
