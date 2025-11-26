'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { createCategoryAction } from "@/app/actions";
import type { Category } from "@/lib/types";
import { useBooks } from "@/context/BookContext";
import { useToast } from "@/hooks/use-toast";

export default function ManageCategories({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isPending, startTransition] = useTransition();
  const { activeBook } = useBooks();
  const { toast } = useToast();

  const handleAddCategory = () => {
    if (!activeBook) return;
    startTransition(async () => {
      const result = await createCategoryAction(activeBook.id, newCategoryName);
      if (result.success) {
        setNewCategoryName("");
        setOpen(false);
        toast({ title: 'Success', description: `Category '${newCategoryName}' created.` });
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Add New Category</DialogTitle>
          <DialogDescription>
            Create a new category to organize your accounts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-right">
              Category Name
            </Label>
            <Input
              id="name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g., Long-term Assets"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAddCategory} disabled={isPending || !newCategoryName.trim()}>
            {isPending ? "Adding..." : "Add Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
