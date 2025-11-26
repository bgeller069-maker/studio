
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Moon, Sun, Trash2, Book, Paintbrush, Home, Users, List } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import ManageBooks from './ManageBooks';
import type { Book as BookType } from '@/lib/types';
import { useBooks } from '@/context/BookContext';


type Theme = 'light' | 'dark';
type TransactionView = 'to_from' | 'dr_cr';

type SettingsClientProps = {
  initialBooks: BookType[];
}

export default function SettingsClient({ initialBooks }: SettingsClientProps) {
  const { toast } = useToast();
  const [theme, setTheme] = useState<Theme>('light');
  const [transactionView, setTransactionView] = useState<TransactionView>('to_from');
  const [isMounted, setIsMounted] = useState(false);
  const { activeBook } = useBooks();
  
  useEffect(() => {
    // Theme is global
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    }
    
    // Transaction view is book-specific
    if (activeBook) {
      const storedView = localStorage.getItem(`transactionView_${activeBook.id}`) as TransactionView | null;
      if (storedView) {
        setTransactionView(storedView);
      } else {
        setTransactionView('to_from'); // default
      }
    }
    
    setIsMounted(true);
  }, [activeBook]);

  if (!isMounted) {
    return null; // or a loading spinner
  }
  
  const handleThemeChange = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', isDark);
    toast({
      title: `Theme changed to ${newTheme}`,
    });
  };
  
  const handleTransactionViewChange = (view: TransactionView) => {
    if (!activeBook) return;
    setTransactionView(view);
    localStorage.setItem(`transactionView_${activeBook.id}`, view);
    toast({
      title: `Transaction view set to "${view === 'to_from' ? 'To/From' : 'Dr/Cr'}" for book: ${activeBook.name}`,
      description: "Refresh may be required for all views to update.",
    });
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
       <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            
            <h1 className="text-3xl font-headline">Settings</h1>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Paintbrush className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="dark-mode" className="flex items-center gap-2">
                <Moon className="w-4 h-4" />
                Dark Mode
                <Sun className="w-4 h-4" />
              </Label>
              <Switch
                id="dark-mode"
                checked={theme === 'dark'}
                onCheckedChange={handleThemeChange}
              />
            </div>
             <div className="space-y-3 rounded-lg border p-3">
                <Label>Transaction Display</Label>
                <p className="text-sm text-muted-foreground">Choose display for <span className="font-bold">{activeBook?.name}</span>.</p>
                <RadioGroup 
                    value={transactionView} 
                    onValueChange={(value: TransactionView) => handleTransactionViewChange(value)}
                    className="flex gap-4 pt-2"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="to_from" id="to_from" />
                        <Label htmlFor="to_from">To / From</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dr_cr" id="dr_cr" />
                        <Label htmlFor="dr_cr">Debit / Credit</Label>
                    </div>
                </RadioGroup>
            </div>
          </CardContent>
        </Card>
        
        <ManageBooks initialBooks={initialBooks} />

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Trash2 className="w-8 h-8 text-primary" />
            <div>
              <CardTitle>Recycle Bin</CardTitle>
              <CardDescription>Restore deleted items.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-center items-center text-center space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
                Deleted items will appear here for 30 days before being permanently removed.
            </p>
             <Button variant="secondary" className="w-full" asChild>
                <Link href="/recycle-bin">View Recycle Bin</Link>
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
