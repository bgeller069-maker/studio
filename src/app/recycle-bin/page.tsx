import RecycleBinClient from '@/components/recycle-bin/RecycleBinClient';
import { getRecycleBinItems } from '@/lib/data';

export default async function RecycleBinPage() {
  const items = await getRecycleBinItems();
  return <RecycleBinClient initialItems={items} />;
}
