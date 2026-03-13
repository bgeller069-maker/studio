import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { getBooks } from '@/lib/data';
import { BookProvider } from '@/context/BookContext';
import BottomNav from '@/components/layout/BottomNav';
import IdleLogoutGuard from '@/components/auth/IdleLogoutGuard';
import { Inter, Playfair_Display } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  variable: '--font-headline',
});


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
  let initialBooks: Awaited<ReturnType<typeof getBooks>> = [];
  try {
    initialBooks = await getBooks();
  } catch {
    // Not logged in or RLS blocks access; login page and other auth flows don't need books.
  }

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="font-body antialiased">
            <BookProvider initialBooks={initialBooks}>
              <IdleLogoutGuard>
                <div className="min-h-screen flex flex-col">
                  <div className="flex-1 pb-16 md:pb-0">
                    {children}
                  </div>
                  <BottomNav />
                </div>
              </IdleLogoutGuard>
            </BookProvider>
            <Toaster />
      </body>
    </html>
  );
}
