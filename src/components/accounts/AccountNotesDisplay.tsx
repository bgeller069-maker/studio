
'use client';

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FilePenLine, Save, Pencil, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '../ui/card';

type AccountNotesDisplayProps = {
  accountId: string;
};

export default function AccountNotesDisplay({ accountId }: AccountNotesDisplayProps) {
  const [notes, setNotes] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  const { toast } = useToast();
  const storageKey = `account_notes_${accountId}`;

  useEffect(() => {
    const savedNotes = localStorage.getItem(storageKey);
    if (savedNotes) {
      setNotes(savedNotes);
      setTempNotes(savedNotes);
    }
    setIsMounted(true);
  }, [storageKey]);

  const handleSave = () => {
    localStorage.setItem(storageKey, tempNotes);
    setNotes(tempNotes);
    toast({
      title: 'Notes Saved',
      description: 'Your notes for this account have been saved locally.',
    });
    setIsEditing(false);
  };
  
  const handleCancel = () => {
      setTempNotes(notes);
      setIsEditing(false);
  }

  if (!isMounted) {
    return (
        <div className="mb-6 animate-pulse">
            <div className="h-10 w-40 bg-muted rounded-md"></div>
        </div>
    );
  }
  
  if (isEditing) {
      return (
        <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
                <Textarea
                    placeholder="Jot down reminders, contact info, or anything else..."
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    rows={5}
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancel}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                    <Button size="sm" onClick={handleSave}><Save className="mr-2 h-4 w-4"/>Save Notes</Button>
                </div>
            </CardContent>
        </Card>
      );
  }

  return (
    <div className="mb-6">
        {notes ? (
            <Card className="bg-muted/50">
                <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap flex-1">
                            <p className="text-xs text-muted-foreground mb-2 font-semibold flex items-center gap-2">
                                <FilePenLine className="h-4 w-4" /> ACCOUNT NOTES
                            </p>
                            {notes}
                        </div>
                         <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}><Pencil className="mr-2 h-4 w-4"/>Edit</Button>
                    </div>
                </CardContent>
            </Card>
        ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <FilePenLine className="mr-2 h-4 w-4"/>
                Add Notes
            </Button>
        )}
    </div>
  );
}
