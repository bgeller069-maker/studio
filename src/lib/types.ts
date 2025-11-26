
export type Category = {
  id: string;
  name: string;
  bookId: string;
};

export type Account = {
  id: string;
  name: string;
  categoryId: string;
  bookId: string;
  openingBalance?: number;
  openingBalanceType?: 'debit' | 'credit';
};

export type TransactionEntry = {
  accountId: string;
  amount: number;
  type: 'debit' | 'credit';
  description?: string; // Optional description for the specific entry
};

export type Transaction = {
  id: string;
  date: string; // ISO string
  description: string;
  entries: TransactionEntry[];
  bookId: string;
  highlight?: 'yellow' | 'blue' | 'strikethrough';
};

export type Book = {
    id: string;
    name: string;
};

export type Note = {
  id: string;
  bookId: string;
  text: string;
  isCompleted: boolean;
  createdAt: string; // ISO string
};
