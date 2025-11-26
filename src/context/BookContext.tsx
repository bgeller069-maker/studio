'use client';

import type { Book } from '@/lib/types';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BookContextType {
  books: Book[];
  activeBook: Book | null;
  setActiveBook: (book: Book | null) => void;
  isLoading: boolean;
}

const BookContext = createContext<BookContextType | undefined>(undefined);

export const BookProvider = ({ children, initialBooks }: { children: ReactNode, initialBooks: Book[] }) => {
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [activeBook, setActiveBookState] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedBookId = localStorage.getItem('activeBookId');
    let bookToActivate = null;
    
    if (storedBookId) {
        bookToActivate = initialBooks.find(b => b.id === storedBookId) || null;
    }

    // If no stored book or stored book doesn't exist, use the first book.
    if (!bookToActivate && initialBooks.length > 0) {
        bookToActivate = initialBooks[0];
    }
    
    setActiveBookState(bookToActivate);
    
    if (bookToActivate) {
        document.cookie = `activeBookId=${bookToActivate.id}; path=/; max-age=31536000`; // 1 year
        localStorage.setItem('activeBookId', bookToActivate.id);
    } else {
        document.cookie = 'activeBookId=; path=/; max-age=-1';
        localStorage.removeItem('activeBookId');
    }
    
    setIsLoading(false);
    // Update books state if the initialBooks prop changes (e.g. after adding/deleting a book)
    setBooks(initialBooks);

  }, [initialBooks]);
  
  const setActiveBook = (book: Book | null) => {
    setActiveBookState(book);
    if (book) {
      document.cookie = `activeBookId=${book.id}; path=/; max-age=31536000`;
      localStorage.setItem('activeBookId', book.id);
    } else {
      document.cookie = 'activeBookId=; path=/; max-age=-1';
      localStorage.removeItem('activeBookId');
    }
    // Refresh the page to reload data for the new book
    router.refresh();
  };

  const value = { books, activeBook, setActiveBook, isLoading };

  return (
    <BookContext.Provider value={value}>
      {children}
    </BookContext.Provider>
  );
};

export const useBooks = () => {
  const context = useContext(BookContext);
  if (context === undefined) {
    throw new Error('useBooks must be used within a BookProvider');
  }
  return context;
};
