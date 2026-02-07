import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Account, Book, Category, Note, Transaction, TransactionEntry } from '@/lib/types';
import { getSupabaseServerClient } from '@/lib/supabase';

const DEFAULT_BOOK_ID = 'book_default';
const DEFAULT_BOOK_NAME = 'CASHBOOK';
const EQUITY_CATEGORY_NAME = 'Equity';

type DbBookRow = { id: string; name: string };
type DbCategoryRow = { id: string; name: string; book_id: string };
type DbAccountRow = {
  id: string;
  name: string;
  category_id: string;
  book_id: string;
  opening_balance: number | null;
  opening_balance_type: 'debit' | 'credit' | null;
};
type DbTransactionRow = {
  id: string;
  book_id: string;
  date: string;
  description: string;
  highlight: Transaction['highlight'] | null;
};
type DbTransactionEntryRow = {
  id: string;
  transaction_id: string;
  account_id: string;
  amount: number;
  type: TransactionEntry['type'];
  description: string | null;
};
type DbTransactionWithEntries = DbTransactionRow & { entries: DbTransactionEntryRow[] | null };
type DbNoteRow = { id: string; book_id: string; text: string; is_completed: boolean; created_at: string };
type DbRecycleBinRow = { id: string; entity_id: string; entity_type: string; payload: any; deleted_at: string };

type BinItem = { id: string; type: 'transaction' | 'account' | 'category' | 'book'; deletedAt?: string; [key: string]: any };

const createClient = async (): Promise<SupabaseClient> => getSupabaseServerClient();
const generateId = (prefix: string) => `${prefix}_${randomUUID()}`;

const mapBook = (row: DbBookRow): Book => ({ id: row.id, name: row.name });
const mapCategory = (row: DbCategoryRow): Category => ({ id: row.id, name: row.name, bookId: row.book_id });
const mapAccount = (row: DbAccountRow): Account => ({
  id: row.id,
  name: row.name,
  categoryId: row.category_id,
  bookId: row.book_id,
  openingBalance: row.opening_balance ?? undefined,
  openingBalanceType: row.opening_balance_type ?? undefined,
});
const mapTransactionEntry = (row: DbTransactionEntryRow): TransactionEntry => ({
  accountId: row.account_id,
  amount: Number(row.amount),
  type: row.type,
  description: row.description ?? undefined,
});
const mapTransaction = (row: DbTransactionWithEntries): Transaction => ({
  id: row.id,
  bookId: row.book_id,
  date: row.date,
  description: row.description,
  highlight: row.highlight ?? undefined,
  entries: (row.entries ?? []).map(mapTransactionEntry),
});
const mapNote = (row: DbNoteRow): Note => ({
  id: row.id,
  bookId: row.book_id,
  text: row.text,
  isCompleted: row.is_completed,
  createdAt: row.created_at,
});

const DEFAULT_CATEGORY_SEEDS: DbCategoryRow[] = [
  { id: `cat_equity_${DEFAULT_BOOK_ID}`, name: EQUITY_CATEGORY_NAME, book_id: DEFAULT_BOOK_ID },
  { id: 'cat_cash_default', name: 'Cash', book_id: DEFAULT_BOOK_ID },
  { id: 'cat_capital_default', name: 'Capital', book_id: DEFAULT_BOOK_ID },
  { id: 'cat_party_default', name: 'Parties', book_id: DEFAULT_BOOK_ID },
  { id: 'cat_expense_default', name: 'Expenses', book_id: DEFAULT_BOOK_ID },
];

const handleError = (maybeError: any, context: string) => {
  if (!maybeError) {
    return;
  }

  const isSupabaseResult = typeof maybeError === 'object' && maybeError !== null && 'error' in maybeError;
  const error = isSupabaseResult ? maybeError.error : maybeError;

  if (!error) {
    return;
  }

  console.error(context, error);
  throw new Error(`${context}: ${error.message || error}`);
};

const ensureDefaultBook = async (client?: SupabaseClient): Promise<void> => {
  const db = client ?? (await createClient());
  const { data, error } = await db.from('books').select('id').limit(1);
  handleError(error, 'Failed to check books');
  if (data && data.length > 0) {
    return;
  }

  const defaultBook: DbBookRow = { id: DEFAULT_BOOK_ID, name: DEFAULT_BOOK_NAME };
  handleError(await db.from('books').insert(defaultBook), 'Failed to create default book');
  handleError(await db.from('categories').insert(DEFAULT_CATEGORY_SEEDS), 'Failed to seed default categories');

  const obeAccount: DbAccountRow = {
    id: `acc_opening_balance_equity_${DEFAULT_BOOK_ID}`,
    name: 'Opening Balance Equity',
    category_id: `cat_equity_${DEFAULT_BOOK_ID}`,
    book_id: DEFAULT_BOOK_ID,
    opening_balance: null,
    opening_balance_type: null,
  };
  handleError(await db.from('accounts').insert(obeAccount), 'Failed to seed opening balance account');
};

const ensureEquityCategory = async (bookId: string, client: SupabaseClient): Promise<DbCategoryRow> => {
  const equityId = `cat_equity_${bookId}`;
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('id', equityId)
    .maybeSingle();
  handleError(error, 'Failed to fetch equity category');
  if (data) {
    return data;
  }

  const newCategory: DbCategoryRow = { id: equityId, name: EQUITY_CATEGORY_NAME, book_id: bookId };
  handleError(await client.from('categories').insert(newCategory), 'Failed to create equity category');
  return newCategory;
};

const getOpeningBalanceEquityAccount = async (bookId: string): Promise<Account> => {
  const client = await createClient();
  const obeId = `acc_opening_balance_equity_${bookId}`;
  const { data, error } = await client
    .from('accounts')
    .select('*')
    .eq('id', obeId)
    .maybeSingle();
  handleError(error, 'Failed to fetch opening balance account');
  if (data) {
    return mapAccount(data);
  }

  const equityCategory = await ensureEquityCategory(bookId, client);
  const newAccount: DbAccountRow = {
    id: obeId,
    name: 'Opening Balance Equity',
    category_id: equityCategory.id,
    book_id: bookId,
    opening_balance: null,
    opening_balance_type: null,
  };
  handleError(await client.from('accounts').insert(newAccount), 'Failed to create opening balance account');
  return mapAccount(newAccount);
};

const normalizeBinRow = (item: BinItem) => {
  if (!item || !item.id || !item.type) {
    throw new Error('Recycle bin items must include an id and type.');
  }
  const deletedAt = item.deletedAt ?? new Date().toISOString();
  return {
    id: generateId('bin'),
    entity_id: item.id,
    entity_type: item.type,
    payload: { ...item, deletedAt },
    deleted_at: deletedAt,
  } satisfies DbRecycleBinRow;
};

// --- Recycle Bin Helpers ---
export const getRecycleBinItems = async (): Promise<any[]> => {
  const client = await createClient();
  const { data, error } = await client.from('recycle_bin').select('*').order('deleted_at', { ascending: false });
  handleError(error, 'Failed to fetch recycle bin');
  return (data ?? []).map((row) => ({ ...row.payload, type: row.entity_type, deletedAt: row.deleted_at }));
};

export const addToRecycleBin = async (item: BinItem | BinItem[]): Promise<void> => {
  const client = await createClient();
  const items = Array.isArray(item) ? item : [item];
  if (items.length === 0) {
    return;
  }
  const rows = items.map(normalizeBinRow);
  handleError(await client.from('recycle_bin').insert(rows), 'Failed to add items to recycle bin');
};

export const restoreItem = async (item: BinItem): Promise<void> => {
  const client = await createClient();
  const { type, deletedAt, ...payload } = item;
  if (!type) {
    throw new Error('Item type is required to restore.');
  }

  switch (type) {
    case 'book': {
      const row: DbBookRow = { id: payload.id, name: payload.name };
      handleError(await client.from('books').insert(row), 'Failed to restore book');
      break;
    }
    case 'category': {
      const row: DbCategoryRow = { id: payload.id, name: payload.name, book_id: payload.bookId };
      handleError(await client.from('categories').insert(row), 'Failed to restore category');
      break;
    }
    case 'account': {
      const row: DbAccountRow = {
        id: payload.id,
        name: payload.name,
        category_id: payload.categoryId,
        book_id: payload.bookId,
        opening_balance: payload.openingBalance ?? null,
        opening_balance_type: payload.openingBalanceType ?? null,
      };
      handleError(await client.from('accounts').insert(row), 'Failed to restore account');
      break;
    }
    case 'transaction': {
      const row: DbTransactionRow = {
        id: payload.id,
        book_id: payload.bookId,
        date: payload.date,
        description: payload.description,
        highlight: payload.highlight ?? null,
      };
      handleError(await client.from('transactions').insert(row), 'Failed to restore transaction');
      if (Array.isArray(payload.entries) && payload.entries.length > 0) {
        const entryRows = payload.entries.map((entry: TransactionEntry) => ({
          id: generateId('txn_entry'),
          transaction_id: payload.id,
          account_id: entry.accountId,
          amount: entry.amount,
          type: entry.type,
          description: entry.description ?? null,
        }));
        handleError(await client.from('transaction_entries').insert(entryRows), 'Failed to restore transaction entries');
      }
      break;
    }
    default:
      throw new Error(`Unsupported type '${type}' for restore.`);
  }

  handleError(
    await client
      .from('recycle_bin')
      .delete()
      .match({ entity_id: payload.id, entity_type: type, deleted_at: deletedAt }),
    'Failed to remove item from recycle bin',
  );
};

export const deletePermanently = async (item: BinItem): Promise<void> => {
  const client = await createClient();
  handleError(
    await client.from('recycle_bin').delete().match({ entity_id: item.id, entity_type: item.type, deleted_at: item.deletedAt }),
    'Failed to delete recycle bin item',
  );
};

const fetchTransactionsForBook = async (bookId: string, client: SupabaseClient) => {
  const { data, error } = await client
    .from('transactions')
    .select('id, book_id, date, description, highlight, entries:transaction_entries(id, transaction_id, account_id, amount, type, description)')
    .eq('book_id', bookId);
  handleError(error, 'Failed to fetch transactions');
  return (data ?? []).map(mapTransaction);
};

// --- Book Functions ---
export const getBooks = async (): Promise<Book[]> => {
  const client = await createClient();
  await ensureDefaultBook(client);
  const { data, error } = await client.from('books').select('id, name').order('created_at', { ascending: true });
  handleError(error, 'Failed to fetch books');
  return (data ?? []).map(mapBook);
};

export const addBook = async (name: string): Promise<Book> => {
  const client = await createClient();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Book name cannot be empty.');
  }
  const { data: existing, error: existingError } = await client
    .from('books')
    .select('id')
    .ilike('name', trimmed)
    .maybeSingle();
  handleError(existingError, 'Failed to validate book name');
  if (existing) {
    throw new Error('A book with this name already exists.');
  }

  const book: DbBookRow = { id: generateId('book'), name: trimmed };
  handleError(await client.from('books').insert(book), 'Failed to create book');

  const equityCategory = await ensureEquityCategory(book.id, client);
  const obeAccount: DbAccountRow = {
    id: `acc_opening_balance_equity_${book.id}`,
    name: 'Opening Balance Equity',
    category_id: equityCategory.id,
    book_id: book.id,
    opening_balance: null,
    opening_balance_type: null,
  };
  handleError(await client.from('accounts').insert(obeAccount), 'Failed to create opening balance account for book');

  return mapBook(book);
};

export const updateBook = async (id: string, name: string): Promise<Book> => {
  const client = await createClient();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Book name cannot be empty.');
  }
  handleError(await client.from('books').update({ name: trimmed }).eq('id', id), 'Failed to update book');
  return { id, name: trimmed };
};

export const deleteBook = async (id: string): Promise<void> => {
  if (id === DEFAULT_BOOK_ID) {
    throw new Error('Cannot delete the default book.');
  }
  const client = await createClient();
  const { data: book, error: bookError } = await client.from('books').select('*').eq('id', id).maybeSingle();
  handleError(bookError, 'Failed to fetch book');
  if (!book) {
    throw new Error('Book not found.');
  }

  const transactions = await fetchTransactionsForBook(id, client);
  const { data: accountsData, error: accountsError } = await client.from('accounts').select('*').eq('book_id', id);
  handleError(accountsError, 'Failed to fetch accounts');
  const { data: categoriesData, error: categoriesError } = await client.from('categories').select('*').eq('book_id', id);
  handleError(categoriesError, 'Failed to fetch categories');

  await addToRecycleBin([
    { ...book, type: 'book' },
    ...transactions.map((transaction) => ({ ...transaction, type: 'transaction' })),
    ...(accountsData ?? []).map((row) => ({ ...mapAccount(row), type: 'account' })),
    ...(categoriesData ?? []).map((row) => ({ ...mapCategory(row), type: 'category' })),
  ]);

  handleError(await client.from('books').delete().eq('id', id), 'Failed to delete book');
};

// --- Category Functions ---
export const getCategories = async (bookId: string): Promise<Category[]> => {
  const client = await createClient();
  const { data, error } = await client.from('categories').select('*').eq('book_id', bookId).order('name');
  handleError(error, 'Failed to fetch categories');
  if ((!data || data.length === 0) && bookId === DEFAULT_BOOK_ID) {
    handleError(await client.from('categories').insert(DEFAULT_CATEGORY_SEEDS), 'Failed to seed default categories for book');
    return DEFAULT_CATEGORY_SEEDS.map(mapCategory);
  }
  return (data ?? []).map(mapCategory);
};

export const addCategory = async (bookId: string, name: string): Promise<Category> => {
  const client = await createClient();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Category name cannot be empty.');
  }
  const { data: existing, error } = await client
    .from('categories')
    .select('id')
    .eq('book_id', bookId)
    .ilike('name', trimmed)
    .maybeSingle();
  handleError(error, 'Failed to validate category uniqueness');
  if (existing) {
    throw new Error('Category already exists in this book.');
  }

  const row: DbCategoryRow = { id: generateId('cat'), name: trimmed, book_id: bookId };
  handleError(await client.from('categories').insert(row), 'Failed to create category');
  return mapCategory(row);
};

export const updateCategory = async (bookId: string, id: string, name: string): Promise<Category> => {
  const client = await createClient();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Category name cannot be empty.');
  }
  const { data: duplicate, error } = await client
    .from('categories')
    .select('id')
    .eq('book_id', bookId)
    .neq('id', id)
    .ilike('name', trimmed)
    .maybeSingle();
  handleError(error, 'Failed to validate category uniqueness');
  if (duplicate) {
    throw new Error(`A category named "${trimmed}" already exists in this book.`);
  }

  handleError(await client.from('categories').update({ name: trimmed }).eq('id', id).eq('book_id', bookId), 'Failed to update category');
  return { id, name: trimmed, bookId };
};

export const deleteCategory = async (bookId: string, id: string): Promise<void> => {
  if (id.startsWith('cat_equity_')) {
    throw new Error('Cannot delete the system-generated Equity category.');
  }
  const client = await createClient();
  const { data: accounts, error } = await client.from('accounts').select('id, category_id').eq('book_id', bookId).eq('category_id', id);
  handleError(error, 'Failed to check category usage');
  if (accounts && accounts.length > 0) {
    throw new Error('Cannot delete category. It is currently assigned to one or more accounts.');
  }

  const { data: categoryRow, error: catError } = await client.from('categories').select('*').eq('id', id).maybeSingle();
  handleError(catError, 'Failed to fetch category');
  if (!categoryRow) {
    throw new Error('Category not found in this book.');
  }

  await addToRecycleBin({ ...mapCategory(categoryRow), type: 'category' });
  handleError(await client.from('categories').delete().eq('id', id), 'Failed to delete category');
};

// --- Account Functions ---
export const getAccounts = async (bookId: string): Promise<Account[]> => {
  const client = await createClient();
  const { data, error } = await client.from('accounts').select('*').eq('book_id', bookId).order('name');
  handleError(error, 'Failed to fetch accounts');
  return (data ?? []).map(mapAccount);
};

export const addAccount = async (
  bookId: string,
  accountData: Omit<Account, 'id' | 'bookId'>,
): Promise<Account> => {
  const client = await createClient();
  const trimmedName = accountData.name?.trim();
  if (!trimmedName) {
    throw new Error('Account name is required.');
  }

  const { data: existing, error } = await client
    .from('accounts')
    .select('id')
    .eq('book_id', bookId)
    .ilike('name', trimmedName)
    .maybeSingle();
  handleError(error, 'Failed to validate account uniqueness');
  if (existing) {
    throw new Error(`An account named "${trimmedName}" already exists in this book.`);
  }

  const row: DbAccountRow = {
    id: generateId('acc'),
    name: trimmedName,
    category_id: accountData.categoryId,
    book_id: bookId,
    opening_balance: accountData.openingBalance ?? null,
    opening_balance_type: accountData.openingBalanceType ?? null,
  };
  handleError(await client.from('accounts').insert(row), 'Failed to create account');

  if (accountData.openingBalance && accountData.openingBalance > 0) {
    const obeAccount = await getOpeningBalanceEquityAccount(bookId);
    await addTransaction(bookId, {
      date: new Date().toISOString(),
      description: `Opening Balance for ${trimmedName}`,
      entries: [
        { accountId: row.id, amount: accountData.openingBalance, type: accountData.openingBalanceType || 'debit' },
        {
          accountId: obeAccount.id,
          amount: accountData.openingBalance,
          type: (accountData.openingBalanceType || 'debit') === 'debit' ? 'credit' : 'debit',
        },
      ],
    });
  }

  return mapAccount(row);
};

export const updateAccount = async (
  bookId: string,
  accountId: string,
  data: Partial<Omit<Account, 'id' | 'bookId'>>,
): Promise<Account> => {
  const client = await createClient();
  const { data: accountRow, error } = await client.from('accounts').select('*').eq('id', accountId).eq('book_id', bookId).maybeSingle();
  handleError(error, 'Failed to fetch account');
  if (!accountRow) {
    throw new Error('Account not found in this book.');
  }

  if (data.name && data.name !== accountRow.name) {
    const { data: duplicate, error: dupError } = await client
      .from('accounts')
      .select('id')
      .eq('book_id', bookId)
      .neq('id', accountId)
      .ilike('name', data.name)
      .maybeSingle();
    handleError(dupError, 'Failed to validate account uniqueness');
    if (duplicate) {
      throw new Error(`An account named "${data.name}" already exists in this book.`);
    }
  }

  const updatedRow: Partial<DbAccountRow> = {
    name: data.name ?? accountRow.name,
    category_id: data.categoryId ?? accountRow.category_id,
    opening_balance: data.openingBalance ?? accountRow.opening_balance,
    opening_balance_type: data.openingBalanceType ?? accountRow.opening_balance_type,
  };
  handleError(await client.from('accounts').update(updatedRow).eq('id', accountId), 'Failed to update account');

  const transactions = await fetchTransactionsForBook(bookId, client);
  const openingBalanceTx = transactions.find(
    (tx) =>
      tx.description === `Opening Balance for ${accountRow.name}` &&
      tx.entries.some((entry) => entry.accountId === accountId),
  );

  const newBalance = data.openingBalance ?? accountRow.opening_balance ?? 0;
  const newType = data.openingBalanceType || accountRow.opening_balance_type || 'debit';

  if (openingBalanceTx && newBalance > 0) {
    const obeAccount = await getOpeningBalanceEquityAccount(bookId);
    await updateTransaction(bookId, openingBalanceTx.id, {
      date: openingBalanceTx.date,
      description: `Opening Balance for ${updatedRow.name}`,
      highlight: openingBalanceTx.highlight,
      entries: [
        { accountId, amount: newBalance, type: newType },
        { accountId: obeAccount.id, amount: newBalance, type: newType === 'debit' ? 'credit' : 'debit' },
      ],
    });
  } else if (openingBalanceTx && newBalance === 0) {
    await deleteTransaction(bookId, openingBalanceTx.id);
  } else if (!openingBalanceTx && newBalance > 0) {
    const obeAccount = await getOpeningBalanceEquityAccount(bookId);
    await addTransaction(bookId, {
      date: new Date().toISOString(),
      description: `Opening Balance for ${updatedRow.name}`,
      entries: [
        { accountId, amount: newBalance, type: newType },
        { accountId: obeAccount.id, amount: newBalance, type: newType === 'debit' ? 'credit' : 'debit' },
      ],
    });
  } else if (data.name && openingBalanceTx) {
    await updateTransaction(bookId, openingBalanceTx.id, {
      date: openingBalanceTx.date,
      description: `Opening Balance for ${data.name}`,
      highlight: openingBalanceTx.highlight,
      entries: openingBalanceTx.entries,
    });
  }

  return {
    id: accountId,
    name: updatedRow.name!,
    categoryId: updatedRow.category_id!,
    bookId,
    openingBalance: updatedRow.opening_balance ?? undefined,
    openingBalanceType: updatedRow.opening_balance_type ?? undefined,
  };
};

export const deleteAccount = async (bookId: string, id: string): Promise<void> => {
  if (id.startsWith('acc_opening_balance_equity_')) {
    throw new Error('Cannot delete the system-generated Opening Balance Equity account.');
  }
  const client = await createClient();
  const accounts = await getAccounts(bookId);
  const account = accounts.find((acc) => acc.id === id);
  if (!account) {
    throw new Error('Account not found.');
  }

  const transactions = await fetchTransactionsForBook(bookId, client);
  const relatedTransactions = transactions.filter((tx) => tx.entries.some((entry) => entry.accountId === id));
  const openingBalanceTx = relatedTransactions.find((tx) => tx.description === `Opening Balance for ${account.name}`);
  if (relatedTransactions.length > (openingBalanceTx ? 1 : 0)) {
    throw new Error('Cannot delete account with existing transactions. Only accounts with just an opening balance can be auto-cleaned.');
  }

  if (openingBalanceTx) {
    await deleteTransaction(bookId, openingBalanceTx.id);
  }

  await addToRecycleBin({ ...account, type: 'account' });
  handleError(await client.from('accounts').delete().eq('id', id), 'Failed to delete account');
};

export const transferOpeningBalance = async (
  sourceBookId: string,
  targetBookId: string,
  accountId: string,
  accountName: string,
  categoryId: string,
  amount: number,
  balanceType: 'debit' | 'credit',
): Promise<void> => {
  const client = await createClient();
  
  // Get source account's category name
  const sourceCategories = await getCategories(sourceBookId);
  const sourceCategory = sourceCategories.find(c => c.id === categoryId);
  if (!sourceCategory) {
    throw new Error('Source category not found.');
  }

  // Find or create category in target book
  const targetCategories = await getCategories(targetBookId);
  let targetCategory = targetCategories.find(c => c.name.toLowerCase() === sourceCategory.name.toLowerCase());
  
  if (!targetCategory) {
    try {
      targetCategory = await addCategory(targetBookId, sourceCategory.name);
    } catch (error) {
      // If category creation fails, try to find it again (race condition)
      const refreshedCategories = await getCategories(targetBookId);
      targetCategory = refreshedCategories.find(c => c.name.toLowerCase() === sourceCategory.name.toLowerCase());
      if (!targetCategory) {
        throw error;
      }
    }
  }

  // Find or create account in target book
  const targetAccounts = await getAccounts(targetBookId);
  let targetAccount = targetAccounts.find(a => a.name.toLowerCase() === accountName.toLowerCase() && !a.id.startsWith('acc_opening_balance_equity_'));
  
  if (!targetAccount) {
    try {
      targetAccount = await addAccount(targetBookId, {
        name: accountName,
        categoryId: targetCategory.id,
      });
    } catch (error) {
      // If account creation fails (e.g., already exists), try to find it again
      const refreshedAccounts = await getAccounts(targetBookId);
      targetAccount = refreshedAccounts.find(a => a.name.toLowerCase() === accountName.toLowerCase() && !a.id.startsWith('acc_opening_balance_equity_'));
      if (!targetAccount) {
        throw error;
      }
    }
  }

  // Create opening balance transaction in target book
  const obeAccount = await getOpeningBalanceEquityAccount(targetBookId);
  await addTransaction(targetBookId, {
    date: new Date().toISOString(),
    description: 'OPENING BALANCE',
    entries: [
      { accountId: targetAccount.id, amount, type: balanceType },
      { accountId: obeAccount.id, amount, type: balanceType === 'debit' ? 'credit' : 'debit' },
    ],
  });
};

/** Transfer balance from an account in source book to an account in target book. Reduces source and adds to target. */
export const transferBalanceBetweenBooks = async (
  sourceBookId: string,
  targetBookId: string,
  sourceAccountId: string,
  sourceAccountName: string,
  sourceCategoryId: string,
  amount: number,
  balanceType: 'debit' | 'credit',
  targetAccountId?: string,
): Promise<void> => {
  if (sourceBookId === targetBookId) {
    throw new Error('Source and target book must be different.');
  }
  if (amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  const books = await getBooks();
  const targetBook = books.find((b) => b.id === targetBookId);
  const targetBookName = targetBook?.name ?? 'Other book';

  const sourceObe = await getOpeningBalanceEquityAccount(sourceBookId);

  // Source book: reduce balance — credit source + debit OBE for debit balance; debit source + credit OBE for credit balance
  await addTransaction(sourceBookId, {
    date: new Date().toISOString(),
    description: `Transfer to ${targetBookName}`,
    entries: [
      { accountId: sourceAccountId, amount, type: balanceType === 'debit' ? 'credit' : 'debit' },
      { accountId: sourceObe.id, amount, type: balanceType === 'debit' ? 'debit' : 'credit' },
    ],
  });

  const sourceCategories = await getCategories(sourceBookId);
  const sourceCategory = sourceCategories.find((c) => c.id === sourceCategoryId);
  if (!sourceCategory) {
    throw new Error('Source category not found.');
  }

  let targetAccount: Account;
  if (targetAccountId) {
    const targetAccounts = await getAccounts(targetBookId);
    const found = targetAccounts.find((a) => a.id === targetAccountId);
    if (!found) throw new Error('Target account not found.');
    targetAccount = found;
  } else {
    const targetCategories = await getCategories(targetBookId);
    let targetCategory = targetCategories.find((c) => c.name.toLowerCase() === sourceCategory.name.toLowerCase());
    if (!targetCategory) {
      targetCategory = await addCategory(targetBookId, sourceCategory.name);
    }
    const targetAccounts = await getAccounts(targetBookId);
    let acc = targetAccounts.find((a) => a.name.toLowerCase() === sourceAccountName.toLowerCase() && !a.id.startsWith('acc_opening_balance_equity_'));
    if (!acc) {
      acc = await addAccount(targetBookId, { name: sourceAccountName, categoryId: targetCategory.id });
    }
    targetAccount = acc;
  }

  const targetObe = await getOpeningBalanceEquityAccount(targetBookId);
  await addTransaction(targetBookId, {
    date: new Date().toISOString(),
    description: 'Transfer from another book',
    entries: [
      { accountId: targetAccount.id, amount, type: balanceType },
      { accountId: targetObe.id, amount, type: balanceType === 'debit' ? 'credit' : 'debit' },
    ],
  });
};

export const deleteMultipleAccounts = async (bookId: string, accountIds: string[]): Promise<void> => {
  const client = await createClient();
  const accounts = await getAccounts(bookId);
  const transactions = await fetchTransactionsForBook(bookId, client);

  for (const accountId of accountIds) {
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found.`);
    }
    if (account.id.startsWith('acc_opening_balance_equity_')) {
      throw new Error('Cannot delete the system-generated Opening Balance Equity account.');
    }

    const relatedTransactions = transactions.filter((tx) => tx.entries.some((entry) => entry.accountId === account.id));
    const openingBalanceTx = relatedTransactions.find((tx) => tx.description === `Opening Balance for ${account.name}`);

    if (relatedTransactions.length > (openingBalanceTx ? 1 : 0)) {
      throw new Error(`Cannot delete account "${account.name}" because it has existing transactions.`);
    }

    if (openingBalanceTx) {
      await deleteTransaction(bookId, openingBalanceTx.id);
    }
  }

  await addToRecycleBin(accounts.filter((acc) => accountIds.includes(acc.id)).map((acc) => ({ ...acc, type: 'account' })));
  handleError(await client.from('accounts').delete().in('id', accountIds), 'Failed to delete accounts');
};

// --- Transaction Functions ---
export const getTransactions = async (bookId: string): Promise<Transaction[]> => {
  const client = await createClient();
  const { data, error } = await client
    .from('transactions')
    .select('id, book_id, date, description, highlight, entries:transaction_entries(id, transaction_id, account_id, amount, type, description)')
    .eq('book_id', bookId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  handleError(error, 'Failed to fetch transactions');
  return (data ?? []).map(mapTransaction);
};

export const addTransaction = async (
  bookId: string,
  transaction: Omit<Transaction, 'id' | 'bookId'>,
): Promise<Transaction> => {
  const client = await createClient();
  const transactionId = generateId('txn');
  const row: DbTransactionRow = {
    id: transactionId,
    book_id: bookId,
    date: transaction.date,
    description: transaction.description,
    highlight: transaction.highlight ?? null,
  };

  handleError(await client.from('transactions').insert(row), 'Failed to create transaction');
  const entryRows = transaction.entries.map((entry) => ({
    id: generateId('txn_entry'),
    transaction_id: transactionId,
    account_id: entry.accountId,
    amount: entry.amount,
    type: entry.type,
    description: entry.description ?? null,
  }));
  const entriesResult = await client.from('transaction_entries').insert(entryRows);
  if (entriesResult.error) {
    await client.from('transactions').delete().eq('id', transactionId);
    handleError(entriesResult, 'Failed to create transaction entries');
  }

  return {
    id: transactionId,
    bookId,
    date: transaction.date,
    description: transaction.description,
    highlight: transaction.highlight,
    entries: transaction.entries,
  };
};

export const updateTransaction = async (
  bookId: string,
  id: string,
  transaction: Omit<Transaction, 'id' | 'bookId'>,
): Promise<Transaction> => {
  const client = await createClient();
  handleError(
    await client
      .from('transactions')
      .update({
        date: transaction.date,
        description: transaction.description,
        highlight: transaction.highlight ?? null,
      })
      .eq('id', id)
      .eq('book_id', bookId),
    'Failed to update transaction',
  );

  handleError(await client.from('transaction_entries').delete().eq('transaction_id', id), 'Failed to clear transaction entries');
  const entryRows = transaction.entries.map((entry) => ({
    id: generateId('txn_entry'),
    transaction_id: id,
    account_id: entry.accountId,
    amount: entry.amount,
    type: entry.type,
    description: entry.description ?? null,
  }));
  handleError(await client.from('transaction_entries').insert(entryRows), 'Failed to recreate transaction entries');

  return {
    id,
    bookId,
    date: transaction.date,
    description: transaction.description,
    highlight: transaction.highlight,
    entries: transaction.entries,
  };
};

export const updateTransactionHighlight = async (
  bookId: string,
  id: string,
  highlight: Transaction['highlight'] | null,
): Promise<void> => {
  const client = await createClient();
  handleError(
    await client
      .from('transactions')
      .update({ highlight })
      .eq('id', id)
      .eq('book_id', bookId),
    'Failed to update transaction highlight',
  );
};

export const deleteTransaction = async (bookId: string, id: string): Promise<void> => {
  const client = await createClient();
  const { data, error } = await client
    .from('transactions')
    .select('id, book_id, date, description, highlight, entries:transaction_entries(id, transaction_id, account_id, amount, type, description)')
    .eq('id', id)
    .eq('book_id', bookId)
    .maybeSingle();
  handleError(error, 'Failed to fetch transaction');
  if (!data) {
    throw new Error('Transaction not found.');
  }

  await addToRecycleBin({ ...mapTransaction(data), type: 'transaction' });
  handleError(await client.from('transactions').delete().eq('id', id), 'Failed to delete transaction');
};

export const deleteMultipleTransactions = async (bookId: string, transactionIds: string[]): Promise<void> => {
  const client = await createClient();
  const { data, error } = await client
    .from('transactions')
    .select('id, book_id, date, description, highlight, entries:transaction_entries(id, transaction_id, account_id, amount, type, description)')
    .eq('book_id', bookId)
    .in('id', transactionIds);
  handleError(error, 'Failed to fetch transactions for deletion');
  const transactions = (data ?? []).map(mapTransaction);
  if (transactions.length !== transactionIds.length) {
    throw new Error('Some transactions could not be found for deletion.');
  }

  await addToRecycleBin(transactions.map((tx) => ({ ...tx, type: 'transaction' })));
  handleError(await client.from('transactions').delete().in('id', transactionIds), 'Failed to delete transactions');
};

// --- Note Functions ---
export const getNotes = async (bookId: string): Promise<Note[]> => {
  const client = await createClient();
  const { data, error } = await client
    .from('notes')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
  handleError(error, 'Failed to fetch notes');
  return (data ?? []).map(mapNote);
};

export const addNote = async (bookId: string, text: string): Promise<Note> => {
  const client = await createClient();
  const row = {
    id: generateId('note'),
    book_id: bookId,
    text,
    is_completed: false,
    created_at: new Date().toISOString(),
  } satisfies DbNoteRow;
  handleError(await client.from('notes').insert(row), 'Failed to create note');
  return mapNote(row);
};

export const updateNote = async (
  bookId: string,
  id: string,
  data: Partial<Omit<Note, 'id' | 'bookId'>>,
): Promise<Note> => {
  const client = await createClient();
  const payload: Partial<DbNoteRow> = {
    text: data.text,
    is_completed: data.isCompleted,
  };
  handleError(
    await client
      .from('notes')
      .update(payload)
      .eq('id', id)
      .eq('book_id', bookId),
    'Failed to update note',
  );
  const { data: updated, error } = await client.from('notes').select('*').eq('id', id).maybeSingle();
  handleError(error, 'Failed to fetch updated note');
  if (!updated) {
    throw new Error('Note not found.');
  }
  return mapNote(updated);
};

export const deleteNote = async (bookId: string, id: string): Promise<void> => {
  const client = await createClient();
  handleError(await client.from('notes').delete().eq('id', id).eq('book_id', bookId), 'Failed to delete note');
};

// --- Export Functions ---
export const exportAllData = async () => {
  const client = await createClient();
  
  // Fetch all books
  const { data: booksData, error: booksError } = await client.from('books').select('*').order('created_at', { ascending: true });
  handleError(booksError, 'Failed to fetch books');
  const books = (booksData ?? []).map(mapBook);
  
  // Fetch all categories
  const { data: categoriesData, error: categoriesError } = await client.from('categories').select('*').order('name');
  handleError(categoriesError, 'Failed to fetch categories');
  const categories = (categoriesData ?? []).map(mapCategory);
  
  // Fetch all accounts
  const { data: accountsData, error: accountsError } = await client.from('accounts').select('*').order('name');
  handleError(accountsError, 'Failed to fetch accounts');
  const accounts = (accountsData ?? []).map(mapAccount);
  
  // Fetch all transactions with entries
  const { data: transactionsData, error: transactionsError } = await client
    .from('transactions')
    .select('id, book_id, date, description, highlight, entries:transaction_entries(id, transaction_id, account_id, amount, type, description)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  handleError(transactionsError, 'Failed to fetch transactions');
  const transactions = (transactionsData ?? []).map(mapTransaction);
  
  // Fetch all notes
  const { data: notesData, error: notesError } = await client.from('notes').select('*').order('created_at', { ascending: false });
  handleError(notesError, 'Failed to fetch notes');
  const notes = (notesData ?? []).map(mapNote);
  
  // Fetch all recycle bin items
  const recycleBinItems = await getRecycleBinItems();
  
  return {
    books,
    categories,
    accounts,
    transactions,
    notes,
    recycleBin: recycleBinItems,
    exportedAt: new Date().toISOString(),
  };
};
