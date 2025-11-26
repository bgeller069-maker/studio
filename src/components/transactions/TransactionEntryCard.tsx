'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn, evaluateMathExpression } from '@/lib/utils';

type TransactionView = 'to_from' | 'dr_cr';

type TransactionEntryCardProps = {
  control: any;
  index: number;
  remove: (index: number) => void;
  accountOptions: ComboboxOption[];
  isSplit: boolean;
  totalFieldsOfType: number;
  useSeparateNarration: boolean;
  transactionView: TransactionView;
  type: 'debit' | 'credit';
  fieldsLength: number;
};

const TransactionEntryCardComponent = ({
  control,
  index,
  remove,
  accountOptions,
  isSplit,
  totalFieldsOfType,
  useSeparateNarration,
  transactionView,
  type,
  fieldsLength,
}: TransactionEntryCardProps) => {
  const form = useFormContext();
  const fromLabel = transactionView === 'dr_cr' ? 'Credit Account' : 'From Account';
  const toLabel = transactionView === 'dr_cr' ? 'Debit Account' : 'To Account';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const value = e.target.value;
    field.onChange(value); // Store the raw string value

    if (!isSplit && fieldsLength === 2) {
      const otherIndex = index === 0 ? 1 : 0;
      form.setValue(`entries.${otherIndex}.amount`, value, { shouldValidate: true });
    }
  };

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>, field: any) => {
    let value = e.target.value;
    let calculatedAmount: number | string = value;

    if (typeof value === 'string' && value.startsWith('=')) {
        const expression = value.substring(1);
        try {
            calculatedAmount = evaluateMathExpression(expression);
            if (isNaN(calculatedAmount)) {
              form.setError(`entries.${index}.amount`, { type: 'manual', message: 'Invalid expression.' });
              return;
            }
        } catch (error) {
            form.setError(`entries.${index}.amount`, { type: 'manual', message: 'Invalid expression.' });
            return;
        }
    }
    
    // Convert to number for validation and further processing
    const numericAmount = parseFloat(calculatedAmount as string);
    field.onChange(numericAmount);

     if (!isSplit && fieldsLength === 2) {
      const otherIndex = index === 0 ? 1 : 0;
      form.setValue(`entries.${otherIndex}.amount`, numericAmount, { shouldValidate: true });
    }
    form.trigger(`entries.${index}.amount`);
  };
  
  return (
    <Card className={cn("w-full", type === 'debit' ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-red-50/50 dark:bg-red-950/20')}>
      <CardContent className="p-4 space-y-4">
        <h4 className={cn("font-semibold", type === 'debit' ? 'text-green-700' : 'text-red-700')}>
            {type === 'debit' ? toLabel : fromLabel}
        </h4>
         <Controller
          control={control}
          name={`entries.${index}.accountId`}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="sr-only">{type === 'debit' ? toLabel : fromLabel}</FormLabel>
                <FormControl>
                    <Combobox
                        options={accountOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Type account name..."
                        searchPlaceholder="Search accounts..."
                        notFoundPlaceholder="No account found."
                    />
                </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <Controller
          control={control}
          name={`entries.${index}.amount`}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  type="text" // Change to text to allow formula input
                  placeholder="=100+50 or 150"
                  {...field}
                  onChange={(e) => handleAmountChange(e, field)}
                  onBlur={(e) => handleAmountBlur(e, field)}
                  className="bg-background"
                />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
         {useSeparateNarration && (
            <Controller
              control={control}
              name={`entries.${index}.description`}
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className="sr-only">Line Description</FormLabel>
                  <FormControl>
                      <Input placeholder="Line item description (optional)" {...field} className="bg-background" />
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />
          )}

         {isSplit && (
            <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(index)} disabled={totalFieldsOfType <= 1}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export const TransactionEntryCard = React.memo(TransactionEntryCardComponent);
