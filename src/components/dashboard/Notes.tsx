'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Lightbulb, Trash2, Plus, ListTodo, Loader2 } from 'lucide-react';
import { useBooks } from '@/context/BookContext';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import type { Note as NoteItem } from '@/lib/types';
import { getNotesAction, addNoteAction, updateNoteAction, deleteNoteAction } from '@/app/actions';


export default function Notes() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { activeBook } = useBooks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNoteActionPending, startNoteActionTransition] = useTransition();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (activeBook) {
      setIsLoading(true);
      getNotesAction(activeBook.id).then(fetchedNotes => {
        setNotes(fetchedNotes);
        setIsLoading(false);
      });
    }
  }, [activeBook]);


  const handleAddNote = () => {
    if (newNoteText.trim() && activeBook) {
        startNoteActionTransition(async () => {
            const newNote = await addNoteAction(activeBook.id, newNoteText.trim());
            setNotes(prev => [newNote, ...prev]);
            setNewNoteText('');
        });
    }
  };
  
  const handleEditNote = (note: NoteItem) => {
    setEditingNoteId(note.id);
    setEditingText(note.text);
  };
  
  const handleUpdateNote = (id: string) => {
    if (!activeBook || editingText.trim() === '') return;
    
    const originalNote = notes.find(n => n.id === id);
    if (originalNote && originalNote.text === editingText) {
        setEditingNoteId(null);
        return;
    }

    startNoteActionTransition(async () => {
      await updateNoteAction(activeBook.id, id, { text: editingText.trim() });
      setNotes(notes.map(note =>
        note.id === id ? { ...note, text: editingText.trim() } : note
      ));
      setEditingNoteId(null);
    });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      handleUpdateNote(id);
    }
    if (e.key === 'Escape') {
      setEditingNoteId(null);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddNote();
    }
  };
  
  const handleToggleComplete = (id: string, isCompleted: boolean) => {
    if (!activeBook) return;
    startNoteActionTransition(async () => {
      await updateNoteAction(activeBook.id, id, { isCompleted: !isCompleted });
      setNotes(notes.map(note =>
        note.id === id ? { ...note, isCompleted: !isCompleted } : note
      ));
    });
  };
  
  const handleDeleteNote = (id: string) => {
      if (!activeBook) return;
      startNoteActionTransition(async () => {
        await deleteNoteAction(activeBook.id, id);
        setNotes(notes.filter(note => note.id !== id));
      });
  };

  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const currentTarget = e.currentTarget;
    setTimeout(() => {
      if (!currentTarget.contains(document.activeElement)) {
        setIsFocused(false);
        if(newNoteText.trim()) {
            handleAddNote();
        }
      }
    }, 0);
  };
  
  const completedNotes = notes.filter(n => n.isCompleted);
  const activeNotes = notes.filter(n => !n.isCompleted);

  const renderNoteItem = (note: NoteItem) => {
     const isEditing = editingNoteId === note.id;
     
     return (
        <div key={note.id} className="flex items-center gap-3 group" style={{ opacity: isNoteActionPending ? 0.5 : 1 }}>
            <Checkbox
              id={note.id}
              checked={note.isCompleted}
              onCheckedChange={() => handleToggleComplete(note.id, note.isCompleted)}
              disabled={isNoteActionPending || isEditing}
            />
            {isEditing ? (
                 <Input
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => handleUpdateNote(note.id)}
                    onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                    autoFocus
                    className="h-8 text-sm flex-grow"
                 />
            ) : (
                <label
                    htmlFor={note.id}
                    className={cn(
                        "flex-grow text-sm cursor-pointer",
                        note.isCompleted && "line-through text-muted-foreground"
                    )}
                    onClick={() => handleEditNote(note)}
                >
                    {note.text}
                </label>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteNote(note.id)} disabled={isNoteActionPending}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
     );
  }


  return (
    <Card 
      className={cn("transition-all duration-300 ease-in-out", isFocused ? "shadow-lg" : "shadow-sm")}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4 w-full">
            <Lightbulb className={cn("h-6 w-6 text-muted-foreground transition-colors", isFocused && 'text-yellow-500')} />
            <Input
                ref={inputRef}
                placeholder="Take a note..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-grow border-none focus-visible:ring-0 shadow-none text-base"
                disabled={isNoteActionPending}
            />
            <Button variant="ghost" size="icon" onClick={handleAddNote} disabled={!newNoteText.trim() || isNoteActionPending}>
                {isNoteActionPending && newNoteText ? <Loader2 className="animate-spin" /> : <Plus />}
            </Button>
        </div>

        {isLoading ? (
            <div className="mt-4 space-y-2">
                <div className="h-8 bg-muted rounded-md animate-pulse"></div>
                <div className="h-8 bg-muted rounded-md animate-pulse"></div>
            </div>
        ) : (
          <>
            {activeNotes.length > 0 && (
              <div className="mt-4 space-y-2">
                {activeNotes.map(renderNoteItem)}
              </div>
            )}
            
            {completedNotes.length > 0 && (
                <div className="mt-6">
                    <Separator />
                    <h3 className="text-sm font-semibold my-2 flex items-center gap-2 text-muted-foreground"><ListTodo className="h-4 w-4"/> Completed ({completedNotes.length})</h3>
                    <div className="space-y-2">
                        {completedNotes.map(renderNoteItem)}
                    </div>
                </div>
            )}
          </>
        )}

      </CardContent>
    </Card>
  );
}
