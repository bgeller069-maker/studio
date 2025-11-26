'use client';

import { Scale, ChevronsUpDown } from 'lucide-react';
import { useBooks } from '@/context/BookContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '../ui/button';
import Link from 'next/link';

export function Logo() {
  const { books, activeBook, setActiveBook, isLoading } = useBooks();

  if (isLoading) {
    return (
        <div className="flex items-center gap-3" aria-label="CASHBOOK Logo">
            <div className="bg-primary/20 text-primary p-2 rounded-lg">
                <Scale className="h-6 w-6" />
            </div>
            <div className="h-7 w-36 bg-muted rounded-md animate-pulse" />
        </div>
    );
  }

  return (
    <div className="flex items-center gap-3" aria-label="CASHBOOK Logo">
      <Link href="/" className="flex items-center gap-3">
        <div className="bg-primary/20 text-primary p-2 rounded-lg">
          <Scale className="h-6 w-6" />
        </div>
      </Link>
       <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-2xl font-headline font-bold text-foreground tracking-wide p-2 h-auto -ml-2">
                {activeBook ? activeBook.name : 'Select a Book'}
                <ChevronsUpDown className="ml-2 h-5 w-5 opacity-60" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {books.map(book => (
            <DropdownMenuItem key={book.id} onSelect={() => setActiveBook(book)}>
              {book.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
