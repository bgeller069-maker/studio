import { Suspense } from 'react';
import SignupForm from '@/components/auth/SignupForm';

export const metadata = {
  title: 'Sign up | LedgerBalance',
  description: 'Create a new LedgerBalance account.',
};

export default function SignupPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8">
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}

