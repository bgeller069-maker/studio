import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { getBooks } from '@/lib/data';
import { BookProvider } from '@/context/BookContext';
import Header from '@/components/layout/Header';


export const metadata: Metadata = {
  title: 'LedgerBalance',
  description: 'A modern double-entry accounting app.',
  manifest: '/manifest.json',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialBooks = await getBooks();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="font-body antialiased">
            <BookProvider initialBooks={initialBooks}>
              {children}
            </BookProvider>
            <Toaster />
      </body>
    </html>
  );
}
