
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share, FileImage, FileText, Calendar as CalendarIcon, Loader2, Home, Users, List, Folder, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Account } from '@/lib/types';
import { formatCurrency, cn, formatDate } from '@/lib/utils';
import { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import { useBooks } from '@/context/BookContext';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import AccountNotesDisplay from './AccountNotesDisplay';

type LedgerEntry = {
  transactionId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

type AccountLedgerClientProps = {
  account: Account;
  allLedgerEntries: LedgerEntry[];
  categoryName: string;
  normallyDebit: boolean;
};

export default function AccountLedgerClient({ account, allLedgerEntries, categoryName, normallyDebit }: AccountLedgerClientProps) {
  const [isMounted, setIsMounted] = useState(false);
  const { activeBook } = useBooks();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const [isSharing, startSharingTransition] = useTransition();


  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { displayEntries, finalBalance, openingBalance } = useMemo(() => {
    const regularEntries = allLedgerEntries.filter(entry => !entry.description.startsWith('Opening Balance for'));
    const openingBalanceTx = allLedgerEntries.find(entry => entry.description.startsWith('Opening Balance for'));
    
    const initialBookBalance = openingBalanceTx 
        ? normallyDebit 
            ? openingBalanceTx.debit - openingBalanceTx.credit 
            : openingBalanceTx.credit - openingBalanceTx.debit
        : 0;
    
    const entriesBeforeDateRange = dateRange?.from
        ? regularEntries.filter(entry => new Date(entry.date) < new Date(dateRange.from!))
        : [];

    const balanceBeforePeriod = entriesBeforeDateRange.reduce((acc, entry) => {
        const debit = entry.debit;
        const credit = entry.credit;
        return normallyDebit ? acc + debit - credit : acc + credit - debit;
    }, initialBookBalance);

    const openingBalance = balanceBeforePeriod;
    let runningBalance = openingBalance;

    const filteredEntries = regularEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        if (dateRange?.from && entryDate < new Date(dateRange.from)) return false;
        if (dateRange?.to && entryDate > new Date(dateRange.to)) return false;
        return true;
    });

    const ledgerForDisplay = filteredEntries.map(tx => {
        const debit = tx.debit;
        const credit = tx.credit;

        runningBalance = normallyDebit ? runningBalance + debit - credit : runningBalance + credit - debit;
        
        return { ...tx, balance: runningBalance };
    });

    return {
        displayEntries: ledgerForDisplay,
        finalBalance: runningBalance,
        openingBalance: openingBalance,
    };
  }, [allLedgerEntries, dateRange, normallyDebit]);


  const handleShare = (format: 'pdf' | 'image') => {
    startSharingTransition(async () => {
        if (!ledgerRef.current) return;
        
        const exportElement = ledgerRef.current.cloneNode(true) as HTMLElement;
        
        exportElement.querySelector('[data-id="category-card"]')?.remove();
        exportElement.querySelector('[data-id="ledger-entries-header"]')?.remove();
        exportElement.querySelector('[data-id="account-notes"]')?.remove();
        
        const titleElement = document.createElement('div');
        titleElement.innerHTML = `
            <h1 class="text-2xl font-bold text-center mb-1">${account.name} - Ledger</h1>
            <h2 class="text-lg text-muted-foreground text-center mb-4">${activeBook?.name || ''}</h2>
        `;
        exportElement.insertBefore(titleElement, exportElement.firstChild);
        
        const summaryCards = exportElement.querySelectorAll<HTMLElement>('.grid > .lucide-university, .grid > .scale, .grid > .calendar-clock');
        const summaryGrid = exportElement.querySelector<HTMLElement>('.grid.md\\:grid-cols-3');
        if (summaryGrid) {
            Array.from(summaryGrid.children).forEach(child => {
                if (!child.hasAttribute('data-id')) { // Keep only balance cards
                    child.classList.add('col-span-1');
                }
            });
        }


        document.body.appendChild(exportElement);
        
        const canvas = await html2canvas(exportElement, {
            scale: 2,
            useCORS: true,
        });

        document.body.removeChild(exportElement);

        if (format === 'image') {
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${account.name}_Ledger.png`;
            link.href = imgData;
            link.click();
        } else if (format === 'pdf') {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${account.name}_Ledger.pdf`);
        }
    });
  }


  if (!isMounted) {
    return null; 
  }
  
  const isFinalBalanceDebit = normallyDebit ? finalBalance >= 0 : finalBalance < 0;
  const isOpeningBalanceDebit = normallyDebit ? openingBalance >= 0 : openingBalance < 0;


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <Button variant="outline" size="icon" asChild>
                <Link href="/accounts">
                    <ArrowLeft />
                    <span className="sr-only">Back to Accounts</span>
                </Link>
            </Button>
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-headline">{account.name}</h1>
                </div>
                <p className="text-muted-foreground">Account Ledger</p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant="outline" className={cn("w-full flex-1 sm:w-[260px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}</>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isSharing}>
                        {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share className="mr-2 h-4 w-4" />}
                        <span className="hidden sm:inline">{isSharing ? 'Generating...' : 'Share'}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleShare('pdf')} disabled={isSharing}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Share as PDF</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare('image')} disabled={isSharing}>
                        <FileImage className="mr-2 h-4 w-4" />
                        <span>Share as Image</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>
      
        <div ref={ledgerRef} className="bg-background p-4 rounded-lg">
            <div className="grid md:grid-cols-3 gap-6 text-sm mb-6">
            <Card data-id="category-card">
                <CardHeader className="pb-2">
                    <CardDescription>Category</CardDescription>
                    <CardTitle className="text-base"><Badge variant="secondary" className="capitalize">{categoryName}</Badge></CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Opening Balance</CardDescription>
                    <CardTitle className="text-base">
                        {formatCurrency(Math.abs(openingBalance))}
                        <span className="text-xs text-muted-foreground ml-1">{isOpeningBalanceDebit ? 'Dr' : 'Cr'}</span>
                    </CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Balance as of {dateRange?.to ? formatDate(dateRange.to) : 'Today'}</CardDescription>
                    <CardTitle className="text-base font-bold">
                        {formatCurrency(Math.abs(finalBalance))}
                        <span className="text-xs text-muted-foreground ml-1">{isFinalBalanceDebit ? 'Dr' : 'Cr'}</span>
                    </CardTitle>
                </CardHeader>
            </Card>
            </div>

            <div data-id="account-notes">
              <AccountNotesDisplay accountId={account.id} />
            </div>


            <Card className="mt-6">
            <CardHeader data-id="ledger-entries-header">
                <CardTitle>Ledger Entries</CardTitle>
                <CardDescription>Transactions for the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                    <TableCell colSpan={4} className="font-bold">Opening Balance</TableCell>
                    <TableCell className={cn("text-right font-bold", isOpeningBalanceDebit ? 'text-green-600' : 'text-red-600')}>
                        {formatCurrency(Math.abs(openingBalance))}
                        <span className="text-xs text-muted-foreground ml-1">{isOpeningBalanceDebit ? 'Dr' : 'Cr'}</span>
                    </TableCell>
                    </TableRow>

                    {displayEntries.map((entry, index) => {
                      const isDebitBalance = normallyDebit ? entry.balance >= 0 : entry.balance < 0;
                      return (
                        <TableRow key={`${entry.transactionId}-${index}`}>
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell className="text-right text-green-600">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold", isDebitBalance ? 'text-green-600' : 'text-red-600')}>
                                {formatCurrency(Math.abs(entry.balance))}
                                <span className="text-xs text-muted-foreground ml-1">{isDebitBalance ? 'Dr' : 'Cr'}</span>
                            </TableCell>
                        </TableRow>
                      );
                    })}
                    {displayEntries.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No transactions found in this period.</TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </CardContent>
            </Card>
        </div>

    </div>
  );
}
