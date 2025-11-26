import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

type JsonBook = { id: string; name: string };
type JsonCategory = { id: string; name: string; bookId: string };
type JsonAccount = {
  id: string;
  name: string;
  categoryId: string;
  bookId: string;
  openingBalance?: number;
  openingBalanceType?: 'debit' | 'credit';
};
type JsonTransactionEntry = {
  accountId: string;
  amount: number;
  type: 'debit' | 'credit';
  description?: string;
};
type JsonTransaction = {
  id: string;
  bookId: string;
  date: string;
  description?: string;
  highlight?: 'yellow' | 'blue' | 'strikethrough';
  entries: JsonTransactionEntry[];
};
type JsonNote = { id: string; bookId: string; text: string; isCompleted: boolean; createdAt: string };
type JsonRecycleBinItem = { id: string; type: string; deletedAt?: string; [key: string]: any };

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
  highlight: 'yellow' | 'blue' | 'strikethrough' | null;
};
type DbTransactionEntryRow = {
  id: string;
  transaction_id: string;
  account_id: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string | null;
};
type DbNoteRow = {
  id: string;
  book_id: string;
  text: string;
  is_completed: boolean;
  created_at: string;
};
type DbRecycleBinRow = {
  id: string;
  entity_id: string;
  entity_type: string;
  payload: any;
  deleted_at: string;
};

type MigrationSummary = {
  books: number;
  categories: number;
  accounts: number;
  transactions: number;
  transactionEntries: number;
  notes: number;
  recycleBinItems: number;
};

const VALID_HIGHLIGHTS = new Set(['yellow', 'blue', 'strikethrough']);
const ROOT_DIR = path.resolve(process.cwd());
const DATA_DIR = path.resolve(ROOT_DIR, 'src', 'lib', 'data');

const dedupeBy = <T>(items: T[], getKey: (item: T) => string) => {
  const seen = new Map<string, T>();
  const duplicates: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      duplicates.push(item);
      continue;
    }
    seen.set(key, item);
  }
  return { items: Array.from(seen.values()), duplicates };
};

const chunkArray = <T>(input: T[], size = 500): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
};

const readJson = async <T>(fileName: string): Promise<T> => {
  const filePath = path.resolve(DATA_DIR, fileName);
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
};

const ensureEnv = (options: { requireSupabase?: boolean } = {}) => {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    const fullPath = path.resolve(ROOT_DIR, file);
    if (existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: true });
    }
  }

  if (options.requireSupabase !== false) {
    const requiredVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
  }
};

const createSupabaseClient = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const normalizeTransactionDescription = (transaction: JsonTransaction): string => {
  const trimmed = transaction.description?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `[Imported] ${transaction.id}`;
};

const normalizeEntryDescription = (entry: JsonTransactionEntry): string | null => {
  const trimmed = entry.description?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toTransactionEntryId = (transactionId: string, index: number): string => {
  return `txn_entry_${transactionId}_${index}`;
};

const toRecycleBinId = (item: JsonRecycleBinItem): string => {
  const deletedAt = item.deletedAt ?? '';
  const hash = crypto.createHash('sha1').update(`${item.type}:${item.id}:${deletedAt}`).digest('hex').slice(0, 16);
  return `bin_${hash}`;
};

const deleteTransactionEntries = async (client: SupabaseClient, transactionIds: string[]) => {
  for (const idsChunk of chunkArray(transactionIds, 500)) {
    const { error } = await client.from('transaction_entries').delete().in('transaction_id', idsChunk);
    if (error) {
      throw new Error(`Failed to clear transaction entries: ${error.message}`);
    }
  }
};

const resetExistingBookData = async (client: SupabaseClient, bookIds: string[]) => {
  if (bookIds.length === 0) {
    return;
  }
  console.log(`\nResetting existing data for books: ${bookIds.join(', ')}`);
  const { error } = await client.from('books').delete().in('id', bookIds);
  if (error) {
    throw new Error(`Failed to clear existing book data: ${error.message}`);
  }
};

const upsertRows = async <T extends Record<string, any>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  label: string,
) => {
  if (rows.length === 0) {
    console.log(`- Skipping ${label}: nothing to upsert.`);
    return;
  }
  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await client.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed to upsert ${label}: ${error.message}`);
    }
  }
  console.log(`- Upserted ${rows.length} ${label}.`);
};

const insertRows = async <T extends Record<string, any>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  label: string,
) => {
  if (rows.length === 0) {
    console.log(`- Skipping ${label}: nothing to insert.`);
    return;
  }
  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await client.from(table).insert(chunk);
    if (error) {
      throw new Error(`Failed to insert ${label}: ${error.message}`);
    }
  }
  console.log(`- Inserted ${rows.length} ${label}.`);
};

const validateTransactions = (transactions: JsonTransaction[]) => {
  for (const tx of transactions) {
    if (!tx.id) throw new Error('Transaction missing id');
    if (!tx.bookId) throw new Error(`Transaction ${tx.id} missing bookId`);
    if (!tx.date || Number.isNaN(Date.parse(tx.date))) {
      throw new Error(`Transaction ${tx.id} has invalid date "${tx.date}"`);
    }
    if (!Array.isArray(tx.entries) || tx.entries.length === 0) {
      throw new Error(`Transaction ${tx.id} must contain at least one entry`);
    }
    tx.entries.forEach((entry, index) => {
      if (!entry.accountId) {
        throw new Error(`Transaction ${tx.id} entry ${index} missing accountId`);
      }
      if (typeof entry.amount !== 'number' || Number.isNaN(entry.amount)) {
        throw new Error(`Transaction ${tx.id} entry ${index} has invalid amount`);
      }
      if (!['debit', 'credit'].includes(entry.type)) {
        throw new Error(`Transaction ${tx.id} entry ${index} has invalid type "${entry.type}"`);
      }
    });
  }
};

const loadData = async () => {
  const [books, categories, accounts, transactions, notes, recycleBinItems] = await Promise.all([
    readJson<JsonBook[]>('books.json'),
    readJson<JsonCategory[]>('categories.json'),
    readJson<JsonAccount[]>('accounts.json'),
    readJson<JsonTransaction[]>('transactions.json'),
    readJson<JsonNote[]>('notes.json'),
    readJson<JsonRecycleBinItem[]>('recycle-bin.json'),
  ]);

  validateTransactions(transactions);

  const bookRows: DbBookRow[] = books.map((book) => ({ id: book.id, name: book.name }));
  const categoryDedupe = dedupeBy(categories, (category) => `${category.bookId}:${category.name.toLowerCase()}`);
  if (categoryDedupe.duplicates.length > 0) {
    console.warn(`⚠️  Deduped ${categoryDedupe.duplicates.length} categories with duplicate names per book.`);
  }
  const categoryRows: DbCategoryRow[] = categoryDedupe.items.map((category) => ({
    id: category.id,
    name: category.name,
    book_id: category.bookId,
  }));
  const accountDedupe = dedupeBy(accounts, (account) => `${account.bookId}:${account.name.toLowerCase()}`);
  if (accountDedupe.duplicates.length > 0) {
    console.warn(`⚠️  Deduped ${accountDedupe.duplicates.length} accounts with duplicate names per book.`);
  }
  const accountRows: DbAccountRow[] = accountDedupe.items.map((account) => {
    const hasOpeningBalance = typeof account.openingBalance === 'number' && Number.isFinite(account.openingBalance);
    return {
      id: account.id,
      name: account.name,
      category_id: account.categoryId,
      book_id: account.bookId,
      opening_balance: hasOpeningBalance ? account.openingBalance! : null,
      opening_balance_type: hasOpeningBalance ? account.openingBalanceType ?? null : null,
    };
  });
  const transactionRows: DbTransactionRow[] = transactions.map((transaction) => ({
    id: transaction.id,
    book_id: transaction.bookId,
    date: transaction.date,
    description: normalizeTransactionDescription(transaction),
    highlight: transaction.highlight && VALID_HIGHLIGHTS.has(transaction.highlight) ? transaction.highlight : null,
  }));
  const transactionEntryRows: DbTransactionEntryRow[] = transactions.flatMap((transaction) =>
    transaction.entries.map((entry, index) => ({
      id: toTransactionEntryId(transaction.id, index),
      transaction_id: transaction.id,
      account_id: entry.accountId,
      amount: entry.amount,
      type: entry.type,
      description: normalizeEntryDescription(entry),
    })),
  );
  const noteRows: DbNoteRow[] = notes.map((note) => ({
    id: note.id,
    book_id: note.bookId,
    text: note.text?.trim() || '[Imported note]',
    is_completed: note.isCompleted,
    created_at: note.createdAt,
  }));
  const recycleBinRows: DbRecycleBinRow[] = recycleBinItems.map((item) => {
    if (!item.id || !item.type) {
      throw new Error('Recycle bin items must include id and type');
    }
    const deletedAt = item.deletedAt ?? new Date().toISOString();
    return {
      id: toRecycleBinId(item),
      entity_id: item.id,
      entity_type: item.type,
      payload: { ...item, deletedAt },
      deleted_at: deletedAt,
    };
  });

  const summary: MigrationSummary = {
    books: bookRows.length,
    categories: categoryRows.length,
    accounts: accountRows.length,
    transactions: transactionRows.length,
    transactionEntries: transactionEntryRows.length,
    notes: noteRows.length,
    recycleBinItems: recycleBinRows.length,
  };

  return { bookRows, categoryRows, accountRows, transactionRows, transactionEntryRows, noteRows, recycleBinRows, summary };
};

const main = async () => {
  try {
    const args = new Set(process.argv.slice(2));
    const isDryRun = args.has('--dry-run');
    ensureEnv({ requireSupabase: !isDryRun });

    if (isDryRun) {
      console.log('Running in dry-run mode; no writes will be performed.');
    }

    console.log(`Reading JSON data from: ${DATA_DIR}`);
    const { bookRows, categoryRows, accountRows, transactionRows, transactionEntryRows, noteRows, recycleBinRows, summary } =
      await loadData();

    console.table(summary);

    if (isDryRun) {
      return;
    }

    const client = createSupabaseClient();
    console.log('\nStarting migration...\n');

    const bookIds = Array.from(new Set(bookRows.map((book) => book.id)));
    await resetExistingBookData(client, bookIds);

    await upsertRows(client, 'books', bookRows, 'books');
    await upsertRows(client, 'categories', categoryRows, 'categories');
    await upsertRows(client, 'accounts', accountRows, 'accounts');
    await upsertRows(client, 'transactions', transactionRows, 'transactions');

    if (transactionRows.length > 0) {
      await deleteTransactionEntries(client, transactionRows.map((tx) => tx.id));
      await insertRows(client, 'transaction_entries', transactionEntryRows, 'transaction entries');
    }

    await upsertRows(client, 'notes', noteRows, 'notes');
    await upsertRows(client, 'recycle_bin', recycleBinRows, 'recycle bin items');

    console.log('\nMigration complete! ✅');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  }
};

main();

