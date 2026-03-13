'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { emergencyWipeAction } from '@/app/actions';

const emergencyWipeSchema = z.object({
  email: z.string().min(1, 'Email is required.').email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type EmergencyWipeValues = z.infer<typeof emergencyWipeSchema>;

type EmergencyWipeFormProps = {
  action?: typeof emergencyWipeAction;
};

export default function EmergencyWipeForm({ action }: EmergencyWipeFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<EmergencyWipeValues>({
    resolver: zodResolver(emergencyWipeSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const isBusy = isSubmitting || isPending;

  async function onSubmit(values: EmergencyWipeValues) {
    if (!action) {
      toast({
        title: 'Login not available',
        description: 'This login path is not configured.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('email', values.email);
      formData.set('password', values.password);

      const result = await action(formData);

      if (!result?.success) {
        toast({
          title: 'Login failed',
          description: result?.message ?? 'Unable to sign you in with these details.',
          variant: 'destructive',
        });
        return;
      }

      startTransition(() => {
        router.replace('/login?wipe=success');
      });
    } catch (error) {
      toast({
        title: 'Something went wrong',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="admin@cashbook.com"
                      disabled={isBusy}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      disabled={isBusy}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isBusy}
            >
              {isBusy ? 'Logging in...' : 'Login'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

