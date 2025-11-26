
import type { Account, Category, Transaction, Book, Note } from '@/lib/types';
import fs from 'node:fs/promises';
import path from 'node:path';

// This file contains functions to read and write data from the local filesystem.
// It is intended to be used only on the server side.

const dataDir = path.join(process.cwd(), 'src', 'lib', 'data');

const booksFilePath = path.join(dataDir, 'books.json');
const categoriesFilePath = path.join(dataDir, 'categories.json');
const accountsFilePath = path.join(dataDir, 'accounts.json');
const transactionsFilePath = path.join(dataDir, 'transactions.json');
const recycleBinFilePath = path.join(dataDir, 'recycle-bin.json');
const notesFilePath = path.join(dataDir, 'notes.json');


const readData = async <T>(filePath: string): Promise<T[]> => {
  try {
    await fs.access(filePath);
    const jsonString = await fs.readFile(filePath, 'utf8');
    if (!jsonString) {
        return [];
    }
    return JSON.parse(jsonString) as T[];
  } catch (error: any) {
    if (error.code === 'ENOENT') { // File does not exist
        await fs.writeFile(filePath, '[]', 'utf8');
        return [];
    }
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
};

const writeData = async <T>(filePath: string, data: T[]): Promise<void> => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
  }
};

export const getRecycleBinItems = async (): Promise<any[]> => {
    const items = await readData<any>(recycleBinFilePath);
    return items.sort((a,b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
};

export const addToRecycleBin = async (item: any | any[]) => {
    const bin = await readData<any>(recycleBinFilePath);
    const itemsToAdd = Array.isArray(item) ? item : [item];
    
    itemsToAdd.forEach(i => {
        i.deletedAt = new Date().toISOString();
    });

    const newBin = [...itemsToAdd, ...bin];
    await writeData<any>(recycleBinFilePath, newBin);
}

// --- Recycle Bin Actions ---
export const restoreItem = async (item: any): Promise<void> => {
    let allItems: any[];
    let filePath: string;

    switch (item.type) {
        case 'account':
            filePath = accountsFilePath;
            allItems = await readData<Account>(filePath);
            break;
        case 'transaction':
            filePath = transactionsFilePath;
            allItems = await readData<Transaction>(filePath);
            break;
        case 'category':
            filePath = categoriesFilePath;
            allItems = await readData<Category>(filePath);
            break;
        case 'book':
            filePath = booksFilePath;
            allItems = await readData<Book>(filePath);
            break;
        default:
            throw new Error(`Unknown item type for restore: ${item.type}`);
    }

    const { deletedAt, type, ...originalItem } = item;
    allItems.push(originalItem);
    await writeData(filePath, allItems);

    // Remove from recycle bin
    let bin = await readData<any>(recycleBinFilePath);
    bin = bin.filter(i => i.id !== item.id || i.type !== item.type);
    await writeData<any>(recycleBinFilePath, bin);
};

export const deletePermanently = async (item: any): Promise<void> => {
    let bin = await readData<any>(recycleBinFilePath);
    bin = bin.filter(i => i.id !== item.id || i.type !== item.type);
    await writeData<any>(recycleBinFilePath, bin);
};


// --- Book Functions ---

export const getBooks = async (): Promise<Book[]> => {
  const books = await readData<Book>(booksFilePath);
  if (books.length === 0) {
      const defaultBook = await addBook('CASHBOOK');
      return [defaultBook];
  }
  return books;
};

export const addBook = async (name: string): Promise<Book> => {
  const allBooks = await readData<Book>(booksFilePath);
  if (allBooks.find(b => b.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A book with this name already exists.');
  }

  const newBook: Book = { id: `book_${Date.now()}`, name };
  allBooks.push(newBook);
  await writeData<Book>(booksFilePath, allBooks);

  // Create default Equity category for the new book
  const allCategories = await readData<Category>(categoriesFilePath);
  const equityCategory: Category = { id: `cat_equity_${newBook.id}`, name: 'Equity', bookId: newBook.id };
  allCategories.push(equityCategory);
  await writeData<Category>(categoriesFilePath, allCategories);

  // Create default Opening Balance Equity account for the new book
  const allAccounts = await readData<Account>(accountsFilePath);
  const obeAccount: Account = {
      id: `acc_opening_balance_equity_${newBook.id}`,
      name: 'Opening Balance Equity',
      categoryId: equityCategory.id,
      bookId: newBook.id,
  };
  allAccounts.push(obeAccount);
  await writeData<Account>(accountsFilePath, allAccounts);

  return newBook;
};

export const updateBook = async (id: string, name: string): Promise<Book> => {
  const books = await getBooks();
  const index = books.findIndex(b => b.id === id);
  if (index === -1) {
    throw new Error('Book not found.');
  }
  books[index].name = name;
  await writeData<Book>(booksFilePath, books);
  return books[index];
};

export const deleteBook = async (id: string): Promise<void> => {
  if (id === 'book_default') {
      throw new Error('Cannot delete the default book.');
  }
  let books = await getBooks();
  const bookToDelete = books.find(b => b.id === id);
   if (!bookToDelete) {
    throw new Error('Book not found.');
  }
  
  // Find associated data before deleting book reference
  let allTransactions = await readData<Transaction>(transactionsFilePath);
  let allAccounts = await readData<Account>(accountsFilePath);
  let allCategories = await readData<Category>(categoriesFilePath);
  
  const transactionsToBin = allTransactions.filter(t => t.bookId === id);
  const accountsToBin = allAccounts.filter(a => a.bookId === id);
  const categoriesToBin = allCategories.filter(c => c.bookId === id);

  await addToRecycleBin([
      { ...bookToDelete, type: 'book' },
      ...transactionsToBin.map(t => ({ ...t, type: 'transaction' })),
      ...accountsToBin.map(a => ({ ...a, type: 'account' })),
      ...categoriesToBin.map(c => ({ ...c, type: 'category' }))
  ]);
  
  // Filter out the deleted book and its data
  const remainingBooks = books.filter(b => b.id !== id);
  const remainingTransactions = allTransactions.filter(t => t.bookId !== id);
  const remainingAccounts = allAccounts.filter(a => a.bookId !== id);
  const remainingCategories = allCategories.filter(c => c.bookId !== id);

  await writeData(booksFilePath, remainingBooks);
  await writeData(transactionsFilePath, remainingTransactions);
  await writeData(accountsFilePath, remainingAccounts);
  await writeData(categoriesFilePath, remainingCategories);
};


// --- Other Data Functions ---
const getOpeningBalanceEquityAccount = async(bookId: string): Promise<Account> => {
    const allAccounts = await readData<Account>(accountsFilePath);
    let obeAccount = allAccounts.find(a => a.id === `acc_opening_balance_equity_${bookId}`);
    
    if (!obeAccount) {
        // Find or create the equity category
        const allCategories = await readData<Category>(categoriesFilePath);
        let equityCategory = allCategories.find(c => c.bookId === bookId && c.name.toLowerCase() === 'equity');
        if (!equityCategory) {
            equityCategory = { id: `cat_equity_${bookId}`, name: 'Equity', bookId };
            allCategories.push(equityCategory);
            await writeData<Category>(categoriesFilePath, allCategories);
        }

        obeAccount = {
            id: `acc_opening_balance_equity_${bookId}`,
            name: 'Opening Balance Equity',
            categoryId: equityCategory.id,
            bookId: bookId,
        };
        allAccounts.push(obeAccount);
        await writeData<Account>(accountsFilePath, allAccounts);
    }
    return obeAccount;
}

export const getCategories = async (bookId: string): Promise<Category[]> => {
  const categories = await readData<Category>(categoriesFilePath);
  const bookCategories = categories.filter(c => c.bookId === bookId);

  if (bookCategories.length === 0 && bookId === 'book_default') {
      const defaultCategories: Category[] = [
        { id: 'cat_cash_default', name: 'Cash', bookId },
        { id: 'cat_capital_default', name: 'Capital', bookId },
        { id: 'cat_party_default', name: 'Parties', bookId },
        { id: 'cat_expense_default', name: 'Expenses', bookId },
      ];
      const allCategories = [...categories, ...defaultCategories];
      await writeData<Category>(categoriesFilePath, allCategories);
      return defaultCategories;
  }
  return bookCategories;
};

export const getAccounts = async (bookId: string): Promise<Account[]> => {
    const allAccounts = await readData<Account>(accountsFilePath);
    return allAccounts.filter(a => a.bookId === bookId);
};

export const getTransactions = async (bookId: string): Promise<Transaction[]> => {
  const transactions = await readData<Transaction>(transactionsFilePath);
  const bookTransactions = transactions.filter(t => t.bookId === bookId);
  // Return sorted by date descending
  return bookTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const addTransaction = async (bookId: string, transaction: Omit<Transaction, 'id' | 'bookId'>): Promise<Transaction> => {
  const allTransactions = await readData<Transaction>(transactionsFilePath);
  const newTransaction: Transaction = {
    ...transaction,
    id: `txn_${Date.now()}`,
    bookId: bookId
  };
  allTransactions.unshift(newTransaction);
  await writeData<Transaction>(transactionsFilePath, allTransactions);
  return newTransaction;
};

export const updateTransaction = async (bookId: string, id: string, transaction: Omit<Transaction, 'id' | 'bookId'>): Promise<Transaction> => {
  const allTransactions = await readData<Transaction>(transactionsFilePath);
  const index = allTransactions.findIndex(t => t.id === id && t.bookId === bookId);
  if (index === -1) {
    throw new Error('Transaction not found in this book.');
  }
  const updatedTransaction = { ...allTransactions[index], ...transaction, id, bookId };
  allTransactions[index] = updatedTransaction;
  await writeData<Transaction>(transactionsFilePath, allTransactions);
  return updatedTransaction;
};

export const updateTransactionHighlight = async (bookId: string, id: string, highlight: Transaction['highlight'] | null): Promise<void> => {
    const allTransactions = await readData<Transaction>(transactionsFilePath);
    const index = allTransactions.findIndex(t => t.id === id && t.bookId === bookId);
    if (index === -1) {
        throw new Error('Transaction not found.');
    }
    if (highlight) {
        allTransactions[index].highlight = highlight;
    } else {
        delete allTransactions[index].highlight;
    }
    await writeData<Transaction>(transactionsFilePath, allTransactions);
};

export const addCategory = async (bookId: string, name: string): Promise<Category> => {
  const allCategories = await readData<Category>(categoriesFilePath);
  const newCategory: Category = { id: `cat_${Date.now()}`, name, bookId };
  if (allCategories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.bookId === bookId)) {
    throw new Error('Category already exists in this book.');
  }
  allCategories.push(newCategory);
await writeData<Category>(categoriesFilePath, allCategories);
  return newCategory;
};

export const updateCategory = async (bookId: string, id: string, name: string): Promise<Category> => {
    const allCategories = await readData<Category>(categoriesFilePath);
    const index = allCategories.findIndex(c => c.id === id && c.bookId === bookId);
    if (index === -1) {
        throw new Error('Category not found in this book.');
    }
    if (allCategories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.bookId === bookId && c.id !== id)) {
        throw new Error(`A category named "${name}" already exists in this book.`);
    }
    allCategories[index].name = name;
    await writeData<Category>(categoriesFilePath, allCategories);
    return allCategories[index];
};

export const deleteCategory = async (bookId: string, id: string): Promise<void> => {
    const accounts = await getAccounts(bookId);
    if (id.startsWith('cat_equity_')) {
        throw new Error('Cannot delete the system-generated Equity category.');
    }
    const isCategoryInUse = accounts.some(acc => acc.categoryId === id);
    if (isCategoryInUse) {
        throw new Error('Cannot delete category. It is currently assigned to one or more accounts.');
    }

    let allCategories = await readData<Category>(categoriesFilePath);
    const categoryToDelete = allCategories.find(c => c.id === id && c.bookId === bookId);
    
    if (!categoryToDelete) {
        throw new Error('Category not found in this book.');
    }
    
    await addToRecycleBin({ ...categoryToDelete, type: 'category' });

    const remainingCategories = allCategories.filter(c => c.id !== id);
    await writeData<Category>(categoriesFilePath, remainingCategories);
};

export const deleteTransaction = async (bookId: string, id: string): Promise<void> => {
  let allTransactions = await readData<Transaction>(transactionsFilePath);
  const index = allTransactions.findIndex(t => t.id === id && t.bookId === bookId);
  if (index === -1) {
    throw new Error('Transaction not found.');
  }
  const [deletedTransaction] = allTransactions.splice(index, 1);
  await addToRecycleBin({ ...deletedTransaction, type: 'transaction' });
  await writeData<Transaction>(transactionsFilePath, allTransactions);
};

export const deleteMultipleTransactions = async (bookId: string, transactionIds: string[]): Promise<void> => {
    let allTransactions = await readData<Transaction>(transactionsFilePath);
    
    const transactionsToDelete = allTransactions.filter(t => t.bookId === bookId && transactionIds.includes(t.id));
    if (transactionsToDelete.length !== transactionIds.length) {
        throw new Error('Some transactions could not be found for deletion.');
    }

    await addToRecycleBin(transactionsToDelete.map(t => ({...t, type: 'transaction'})));

    const remainingTransactions = allTransactions.filter(t => !(t.bookId === bookId && transactionIds.includes(t.id)));

    await writeData<Transaction>(transactionsFilePath, remainingTransactions);
};

export const addAccount = async (
  bookId: string, 
  accountData: Omit<Account, 'id' | 'bookId'>
): Promise<Account> => {
    const allAccounts = await readData<Account>(accountsFilePath);
    
    if (accountData.name) {
        const existingAccount = allAccounts.find(acc => acc.bookId === bookId && acc.name.toLowerCase() === accountData.name.toLowerCase());
        if (existingAccount) {
            throw new Error(`An account named "${accountData.name}" already exists in this book.`);
        }
    }


    const newAccount: Account = {
        id: `acc_${Date.now()}`,
        bookId: bookId,
        name: accountData.name,
        categoryId: accountData.categoryId,
    };
    allAccounts.push(newAccount);
    await writeData<Account>(accountsFilePath, allAccounts);

    // If there's an opening balance, create a transaction for it
    if (accountData.openingBalance && accountData.openingBalance > 0) {
        const obeAccount = await getOpeningBalanceEquityAccount(bookId);

        const newAccountEntry = {
            accountId: newAccount.id,
            amount: accountData.openingBalance,
            type: accountData.openingBalanceType || 'debit',
        };

        const obeAccountEntry = {
            accountId: obeAccount.id,
            amount: accountData.openingBalance,
            type: newAccountEntry.type === 'debit' ? 'credit' : 'debit',
        };

        await addTransaction(bookId, {
            date: new Date().toISOString(),
            description: `Opening Balance for ${newAccount.name}`,
            entries: [newAccountEntry, obeAccountEntry],
        });
    }

    return newAccount;
};

export const updateAccount = async (bookId: string, accountId: string, data: Partial<Omit<Account, 'id' | 'bookId'>>): Promise<Account> => {
  const allAccounts = await readData<Account>(accountsFilePath);
  const allTransactions = await readData<Transaction>(transactionsFilePath);
  
  const index = allAccounts.findIndex(a => a.id === accountId && a.bookId === bookId);
  if (index === -1) {
    throw new Error('Account not found in this book.');
  }
  
  const originalAccount = allAccounts[index];

  if (data.name && data.name !== originalAccount.name) {
    const existingAccount = allAccounts.find(acc => acc.bookId === bookId && acc.name.toLowerCase() === data.name?.toLowerCase() && acc.id !== accountId);
    if (existingAccount) {
        throw new Error(`An account named "${data.name}" already exists in this book.`);
    }
  }

  const updatedAccount = { ...originalAccount, ...data };
  allAccounts[index] = updatedAccount;
  
  // --- Opening Balance Logic ---
  const openingBalanceTx = allTransactions.find(t => 
      t.bookId === bookId &&
      t.description === `Opening Balance for ${originalAccount.name}` &&
      t.entries.some(e => e.accountId === accountId)
  );

  const newBalance = data.openingBalance;
  const newType = data.openingBalanceType || 'debit';

  // Case 1: OB existed, and is being updated to a non-zero value
  if (openingBalanceTx && newBalance && newBalance > 0) {
      const obeAccount = await getOpeningBalanceEquityAccount(bookId);
      const newEntries = [
          { accountId: accountId, amount: newBalance, type: newType },
          { accountId: obeAccount.id, amount: newBalance, type: newType === 'debit' ? 'credit' : 'debit' }
      ];
      await updateTransaction(bookId, openingBalanceTx.id, {
          ...openingBalanceTx,
          description: `Opening Balance for ${updatedAccount.name}`, // Also update name here
          entries: newEntries
      });
  } 
  // Case 2: OB existed, and is being updated to zero (or removed) -> delete the OB transaction
  else if (openingBalanceTx && (!newBalance || newBalance === 0)) {
      await deleteTransaction(bookId, openingBalanceTx.id);
  }
  // Case 3: OB did NOT exist, and is being created with a non-zero value
  else if (!openingBalanceTx && newBalance && newBalance > 0) {
       const obeAccount = await getOpeningBalanceEquityAccount(bookId);
        const newAccountEntry = {
            accountId: accountId,
            amount: newBalance,
            type: newType,
        };
        const obeAccountEntry = {
            accountId: obeAccount.id,
            amount: newBalance,
            type: newType === 'debit' ? 'credit' : 'debit',
        };
        await addTransaction(bookId, {
            date: new Date().toISOString(),
            description: `Opening Balance for ${updatedAccount.name}`,
            entries: [newAccountEntry, obeAccountEntry],
        });
  }
  // Case 4: Name change only, no balance change, but OB exists
  else if (data.name && data.name !== originalAccount.name && openingBalanceTx) {
      await updateTransaction(bookId, openingBalanceTx.id, { ...openingBalanceTx, description: `Opening Balance for ${data.name}`});
  }
  
  // Write the final account data
  await writeData<Account>(accountsFilePath, allAccounts);

  return updatedAccount;
};

export const deleteAccount = async (bookId: string, id: string): Promise<void> => {
    if (id.startsWith('acc_opening_balance_equity_')) {
        throw new Error('Cannot delete the system-generated Opening Balance Equity account.');
    }

    let allTransactions = await readData<Transaction>(transactionsFilePath);
    let allAccounts = await readData<Account>(accountsFilePath);

    const accountToDelete = allAccounts.find(a => a.id === id && a.bookId === bookId);
    if (!accountToDelete) {
        throw new Error('Account not found.');
    }

    const accountTransactions = allTransactions.filter(t => t.bookId === bookId && t.entries.some(e => e.accountId === id));
    const openingBalanceTx = accountTransactions.find(t => t.description === `Opening Balance for ${accountToDelete.name}`);

    // Check if there are any *other* transactions
    if (accountTransactions.length > (openingBalanceTx ? 1 : 0)) {
        throw new Error('Cannot delete account with existing transactions. Only accounts with just an opening balance can be auto-cleaned.');
    }
    
    // If an opening balance transaction exists, delete it first
    if (openingBalanceTx) {
        await deleteTransaction(bookId, openingBalanceTx.id);
    }
    
    // Now delete the account
    const remainingAccounts = allAccounts.filter(a => a.id !== id || a.bookId !== bookId);
    await addToRecycleBin({ ...accountToDelete, type: 'account' });
    await writeData<Account>(accountsFilePath, remainingAccounts);
};

export const deleteMultipleAccounts = async (bookId: string, accountIds: string[]): Promise<void> => {
    const allTransactions = await readData<Transaction>(transactionsFilePath);
    let allAccounts = await readData<Account>(accountsFilePath);

    let accountsToDelete = allAccounts.filter(acc => acc.bookId === bookId && accountIds.includes(acc.id));

    for (const account of accountsToDelete) {
        if (account.id.startsWith('acc_opening_balance_equity_')) {
            throw new Error(`Cannot delete the system-generated Opening Balance Equity account.`);
        }
        
        const accountTransactions = allTransactions.filter(t => t.bookId === bookId && t.entries.some(e => e.accountId === account.id));
        const openingBalanceTx = accountTransactions.find(t => t.description === `Opening Balance for ${account.name}`);
        
        if (accountTransactions.length > (openingBalanceTx ? 1 : 0)) {
            throw new Error(`Cannot delete account "${account.name}" because it has existing transactions.`);
        }

        if (openingBalanceTx) {
            await deleteTransaction(bookId, openingBalanceTx.id);
        }

        await addToRecycleBin({ ...account, type: 'account' });
    }
    
    const remainingAccounts = allAccounts.filter(acc => !accountIds.includes(acc.id) || acc.bookId !== bookId);
    await writeData<Account>(accountsFilePath, remainingAccounts);
};


// --- Note Functions ---

export const getNotes = async (bookId: string): Promise<Note[]> => {
    const allNotes = await readData<Note>(notesFilePath);
    const bookNotes = allNotes.filter(note => note.bookId === bookId);
    return bookNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addNote = async (bookId: string, text: string): Promise<Note> => {
    const allNotes = await readData<Note>(notesFilePath);
    const newNote: Note = {
        id: `note_${Date.now()}`,
        bookId,
        text,
        isCompleted: false,
        createdAt: new Date().toISOString(),
    };
    allNotes.unshift(newNote);
    await writeData<Note>(notesFilePath, allNotes);
    return newNote;
};

export const updateNote = async (bookId: string, id: string, data: Partial<Omit<Note, 'id' | 'bookId'>>): Promise<Note> => {
    const allNotes = await readData<Note>(notesFilePath);
    const index = allNotes.findIndex(note => note.id === id && note.bookId === bookId);
    if (index === -1) {
        throw new Error('Note not found.');
    }
    const updatedNote = { ...allNotes[index], ...data };
    allNotes[index] = updatedNote;
    await writeData<Note>(notesFilePath, allNotes);
    return updatedNote;
};

export const deleteNote = async (bookId: string, id: string): Promise<void> => {
    let allNotes = await readData<Note>(notesFilePath);
    const remainingNotes = allNotes.filter(note => note.id !== id || note.bookId !== bookId);
    await writeData<Note>(notesFilePath, remainingNotes);
};
