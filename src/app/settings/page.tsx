import SettingsClient from '@/components/settings/SettingsClient';
import { getBooks } from '@/lib/data';
import { getSupabaseServerClient } from '@/lib/supabase';

const USER_MANAGER_ID = '1920e0f7-52b4-486c-9c86-ae0152016da7';

export default async function SettingsPage() {
  const books = await getBooks();
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canManageUsers = user?.id === USER_MANAGER_ID;

  return (
      <SettingsClient initialBooks={books} canManageUsers={canManageUsers} />
  );
}
