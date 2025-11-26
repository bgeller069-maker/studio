'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import type { Account, Category, Transaction } from '@/lib/types';
import { useTransition, useMemo, useState, useEffect } from 'react';
import { createTransactionAction, updateTransactionAction } from '@/app/actions';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AddAccountForm from '@/components/accounts/AddAccountForm';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { TransactionEntryCard } from './TransactionEntryCard';
import { useToast } from '@/hooks/use-toast';

const transactionEntrySchema = z.object({
  accountId: z.string().min(1, 'Account is required.'),
  type: z.enum(['debit', 'credit']),
  amount: z.any()
    .transform(val => (val === '' || val == null) ? '' : val) // Keep empty strings as is
    .pipe(z.union([
        z.string().startsWith('='), // Allow formulas
        z.coerce.number({ invalid_type_error: "Amount is required." }).positive('Amount must be positive.'),
    ])),
  description: z.string().optional(),
});

const formSchema = z.object({
  description: z.string().max(100),
  date: z.date({ required_error: 'Date is required.' }),
  entries: z.array(transactionEntrySchema).min(2, 'At least one debit and one credit entry are required.'),
  useSeparateNarration: z.boolean().default(false),
})
.refine(data => {
    if (data.useSeparateNarration) return true;
    return data.description.length > 0;
}, {
    message: 'Description is required.',
    path: ['description'],
})
.refine(
  (data) => {
    const totalDebits = data.entries.filter(e => e.type === 'debit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalCredits = data.entries.filter(e => e.type === 'credit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return Math.abs(totalDebits - totalCredits) < 0.01;
  },
  {
    message: 'Total "To" amounts must equal total "From" amounts.',
    path: ['entries'],
  }
);

type AddTransactionFormProps = {
  accounts: Account[];
  categories: Category[];
  onFinished: () => void;
  initialData?: Transaction | null;
  bookId: string;
};

type TransactionView = 'to_from' | 'dr_cr';

export default function AddTransactionForm({ accounts, categories, onFinished, initialData, bookId }: AddTransactionFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isAddAccountOpen, setAddAccountOpen] = useState(false);
  const [transactionView, setTransactionView] = useState<TransactionView>('to_from');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (bookId) {
      const storedView = localStorage.getItem(`transactionView_${bookId}`) as TransactionView | null;
      if (storedView) {
        setTransactionView(storedView);
      }
    }
    setIsMounted(true);
  }, [bookId]);

  const isEditMode = !!initialData;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      date: new Date(),
      entries: [
        { accountId: '', type: 'debit', amount: '' as any, description: '' },
        { accountId: '', type: 'credit', amount: '' as any, description: '' },
      ],
      useSeparateNarration: false,
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'entries',
  });

  const [isSplit, setIsSplit] = useState(false);

  useEffect(() => {
    if (initialData) {
        form.reset({
            ...initialData,
            date: new Date(initialData.date),
            entries: initialData.entries.map(e => ({
                ...e,
                amount: e.amount || '', // Ensure it's a number or empty string
                description: e.description || ''
            })),
            useSeparateNarration: initialData.entries.some(e => e.description)
        });
        if (initialData.entries.length > 2) {
            setIsSplit(true);
        }
    } else {
        form.reset({
            description: '',
            date: new Date(),
            entries: [
                { accountId: '', type: 'debit', amount: '' as any, description: '' },
                { accountId: '', type: 'credit', amount: '' as any, description: '' },
            ],
            useSeparateNarration: false,
        });
        setIsSplit(false);
    }
  }, [initialData, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!bookId) return;

    const finalValues = {
        ...values,
        description: values.useSeparateNarration ? '' : values.description,
    };


    startTransition(async () => {
      const action = isEditMode
        ? updateTransactionAction(bookId, initialData.id, finalValues)
        : createTransactionAction(bookId, finalValues);
      
      const result = await action;

      if (result.success) {
        onFinished();
        form.reset();
      } else {
        toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
        });
        console.error("Failed to save transaction:", result.message);
      }
    });
  };

  const watchedEntries = form.watch('entries');
  const useSeparateNarration = form.watch('useSeparateNarration');
  const { totalDebits, totalCredits } = useMemo(() => {
    const debits = watchedEntries.filter(e => e.type === 'debit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const credits = watchedEntries.filter(e => e.type === 'credit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { totalDebits: debits, totalCredits: credits };
  }, [watchedEntries]);

  const creditFields = fields.map((field, index) => ({ field, index })).filter(({ field }) => field.type === 'credit');
  const debitFields = fields.map((field, index) => ({ field, index })).filter(({ field }) => field.type === 'debit');

  const accountOptions = useMemo(() => accounts.map(acc => ({ value: acc.id, label: acc.name })), [accounts]);
  
  if (!isMounted) {
    return <div>Loading form...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
           <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Transaction Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn('w-full sm:w-[240px] pl-3 text-left font-normal bg-background', !field.value && 'text-muted-foreground')}>
                          {field.value ? format(field.value, 'dd/MM/yyyy') : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <div className="space-y-6">
            {!useSeparateNarration && (
                <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Narration</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Description of transaction..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}
            
             <FormField
                control={form.control}
                name="useSeparateNarration"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <FormLabel className="font-normal">
                            Use separate narration for from and to accounts
                        </FormLabel>
                    </FormItem>
                )}
             />


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                    {debitFields.map((item) => (
                      <TransactionEntryCard
                        key={item.field.id}
                        control={form.control}
                        index={item.index}
                        remove={remove}
                        accountOptions={accountOptions}
                        isSplit={isSplit}
                        totalFieldsOfType={debitFields.length}
                        useSeparateNarration={useSeparateNarration}
                        transactionView={transactionView}
                        type="debit"
                        fieldsLength={fields.length}
                      />
                    ))}
                    {isSplit && (
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', type: 'debit', amount: '' as any, description: '' })} className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add {transactionView === 'dr_cr' ? 'Debit' : 'To'} Account
                        </Button>
                    )}
                </div>
                <div className="space-y-4">
                    {creditFields.map((item) => (
                       <TransactionEntryCard
                        key={item.field.id}
                        control={form.control}
                        index={item.index}
                        remove={remove}
                        accountOptions={accountOptions}
                        isSplit={isSplit}
                        totalFieldsOfType={creditFields.length}
                        useSeparateNarration={useSeparateNarration}
                        transactionView={transactionView}
                        type="credit"
                        fieldsLength={fields.length}
                      />
                    ))}
                    {isSplit && (
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', type: 'credit', amount: '' as any, description: '' })} className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add {transactionView === 'dr_cr' ? 'Credit' : 'From'} Account
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <FormField
                    control={form.control}
                    name="useSeparateNarration" // This is a dummy usage to place the checkbox
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                               <Checkbox id="enable-split" onCheckedChange={(checked) => setIsSplit(!!checked)} checked={isSplit} />
                            </FormControl>
                             <label htmlFor="enable-split" className="text-sm font-medium leading-none cursor-pointer">Enable Split / Compound Entry</label>
                        </FormItem>
                    )}
                 />

                 <Dialog open={isAddAccountOpen} onOpenChange={setAddAccountOpen}>
                  <DialogTrigger asChild>
                     <Button variant="outline">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create New Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-headline text-2xl">Add New Account</DialogTitle>
                    </DialogHeader>
                    <AddAccountForm categories={categories} onFinished={() => setAddAccountOpen(false)} />
                  </DialogContent>
                </Dialog>
            </div>

            {(isSplit || (totalCredits > 0 || totalDebits > 0)) && (
               <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                      <span>Total {transactionView === 'dr_cr' ? 'Debits' : 'To'}:</span>
                      <span className="text-green-600 font-semibold">{formatCurrency(totalDebits)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span>Total {transactionView === 'dr_cr' ? 'Credits' : 'From'}:</span>
                      <span className="text-red-600 font-semibold">{formatCurrency(totalCredits)}</span>
                  </div>
                   <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                      <span>Difference:</span>
                      <span className={cn(Math.abs(totalDebits-totalCredits) > 0.01 ? 'text-destructive' : 'text-green-600')}>{formatCurrency(totalDebits-totalCredits)}</span>
                  </div>
              </div>
            )}
             {form.formState.errors.entries && <FormMessage>{form.formState.errors.entries.message || form.formState.errors.entries.root?.message}</FormMessage>}
        </div>


        <div className="flex items-center justify-end">
            <Button type="submit" disabled={isPending} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isPending ? (isEditMode ? 'Saving...' : 'Recording...') : (isEditMode ? 'Save Changes' : 'Record Transaction')}
            </Button>
        </div>
      </form>
    </Form>
  );
}
