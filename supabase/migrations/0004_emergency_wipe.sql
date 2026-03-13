begin;

-- Emergency wipe function: deletes all application data tables.
create or replace function public.emergency_wipe_all_data()
returns void
language plpgsql
security definer
as $$
begin
  -- Truncate all application tables in one shot.
  -- CASCADE ensures foreign key references are handled correctly.
  truncate table
    public.transaction_entries,
    public.transactions,
    public.accounts,
    public.categories,
    public.notes,
    public.recycle_bin,
    public.books
  restart identity cascade;
end;
$$;

-- Optional: policies to allow the special user id to delete directly.
do $$
declare
  special_user uuid := '2da0bc7c-a8b3-405d-9e19-d6f05fd2bc56';
begin
  -- Books: allow special user full access
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'books' and policyname = 'books_emergency_delete_all'
  ) then
    execute format(
      'create policy books_emergency_delete_all
         on public.books
         for delete
         using (auth.uid() = %L::uuid)',
      special_user
    );
  end if;

  -- Categories
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_emergency_delete_all'
  ) then
    execute format(
      'create policy categories_emergency_delete_all
         on public.categories
         for delete
         using (auth.uid() = %L::uuid)',
      special_user
    );
  end if;

  -- Accounts
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_emergency_delete_all'
  ) then
    execute format(
      'create policy accounts_emergency_delete_all
         on public.accounts
         for delete
         using (auth.uid() = %L::uuid)',
      special_user
    );
  end if;

  -- Transactions
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_emergency_delete_all'
  ) then
    execute format(
      'create policy transactions_emergency_delete_all
         on public.transactions
         for delete
         using (auth.uid() = %L::uuid)',
      special_user
    );
  end if;

  -- Transaction entries
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transaction_entries' and policyname = 'transaction_entries_emergency_delete_all'
  ) then
    execute format(
      'create policy transaction_entries_emergency_delete_all
         on public.transaction_entries
         for delete
         using (auth.uid() = %L::uuid)',
      special_user
    );
  end if;

  -- Notes
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_emergency_delete_all'
  ) then
    execute format(
      'create policy notes_emergency_delete_all
         on public.notes
         for delete
         using (auth.uid() = %L::uuid)',
      special_user
    );
  end if;

  -- Recycle bin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recycle_bin' and policyname = 'recycle_bin_emergency_delete_all'
  ) then
    execute format(
      'create policy recycle_bin_emergency_delete_all
         on public.recycle_bin
         for delete
         using (auth.uid() = %L::uuid)',
      special_user
    );
  end if;
end
$$;

commit;

