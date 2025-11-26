'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Book, Edit, PlusCircle, Trash2 } from 'lucide-react';
import type { Book as BookType } from '@/lib/types';
import { addBookAction, updateBookAction, deleteBookAction } from '@/app/actions';

type ManageBooksProps = {
  initialBooks: BookType[];
};

export default function ManageBooks({ initialBooks }: ManageBooksProps) {
  const [isPending, startTransition] = useTransition();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookType | null>(null);
  const [bookName, setBookName] = useState('');

  const handleAddBook = () => {
    if (!bookName.trim()) {
      return;
    }
    startTransition(async () => {
      const result = await addBookAction(bookName);
      if (result.success) {
        setIsAddDialogOpen(false);
        setBookName('');
      } else {
        console.error(result.message);
      }
    });
  };

  const openEditDialog = (book: BookType) => {
    setEditingBook(book);
    setBookName(book.name);
    setIsEditDialogOpen(true);
  };
  
  const handleUpdateBook = () => {
      if (!editingBook) return;
       if (!bookName.trim()) {
        return;
      }
      startTransition(async () => {
        const result = await updateBookAction(editingBook.id, bookName);
        if (result.success) {
          setIsEditDialogOpen(false);
          setEditingBook(null);
          setBookName('');
        } else {
            console.error(result.message);
        }
      });
  }
  
  const handleDeleteBook = (bookId: string) => {
      startTransition(async () => {
        const result = await deleteBookAction(bookId);
        if (!result.success) {
            console.error(result.message);
        }
      });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Book className="w-8 h-8 text-primary" />
          <div>
            <CardTitle>Book Management</CardTitle>
            <CardDescription>Manage your financial books.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <ul className="space-y-2">
                {initialBooks.map(book => (
                    <li key={book.id} className="flex items-center justify-between rounded-md border p-3">
                       <span className="font-medium">{book.name}</span>
                       <div className="flex items-center gap-2">
                           <Button variant="ghost" size="icon" onClick={() => openEditDialog(book)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={book.id === 'book_default'}><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this book.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteBook(book.id)}
                                    disabled={isPending}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    {isPending ? 'Deleting...' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                       </div>
                    </li>
                ))}
            </ul>
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Book
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a New Book</DialogTitle>
                        <DialogDescription>Give your new financial book a name.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="book-name">Book Name</Label>
                        <Input id="book-name" value={bookName} onChange={e => setBookName(e.target.value)} placeholder="e.g., My Side Business" />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddBook} disabled={isPending}>
                            {isPending ? 'Creating...' : 'Create Book'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        </CardContent>
      </Card>
      
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Book Name</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    <Label htmlFor="edit-book-name">Book Name</Label>
                    <Input id="edit-book-name" value={bookName} onChange={e => setBookName(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button onClick={handleUpdateBook} disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}
