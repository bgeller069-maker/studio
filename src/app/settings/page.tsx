import SettingsClient from '@/components/settings/SettingsClient';
import { getBooks } from '@/lib/data';

export default async function SettingsPage() {
  const books = await getBooks();
  return (
      <SettingsClient initialBooks={books} />
  );
}
