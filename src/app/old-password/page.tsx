import EmergencyWipeForm from '@/components/auth/EmergencyWipeForm';
import { emergencyWipeAction } from '@/app/actions';

export default function OldPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-headline">Old Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to log in.
          </p>
        </div>
        <EmergencyWipeForm action={emergencyWipeAction} />
      </div>
    </div>
  );
}

