begin;

-- Enable RLS on core tables
alter table public.books enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_entries enable row level security;
alter table public.notes enable row level security;
alter table public.recycle_bin enable row level security;

-- Helper: create policy only if it does not already exist
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'books' and policyname = 'books_tenant_select'
  ) then
    create policy books_tenant_select
      on public.books
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'books' and policyname = 'books_tenant_modify'
  ) then
    create policy books_tenant_modify
      on public.books
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

-- Dependent tables: scope via books.user_id
do $$
begin
  -- Categories
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_tenant_all'
  ) then
    create policy categories_tenant_all
      on public.categories
      for all
      using (
        exists (
          select 1 from public.books b
          where b.id = categories.book_id
            and b.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.books b
          where b.id = categories.book_id
            and b.user_id = auth.uid()
        )
      );
  end if;

  -- Accounts
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_tenant_all'
  ) then
    create policy accounts_tenant_all
      on public.accounts
      for all
      using (
        exists (
          select 1 from public.books b
          where b.id = accounts.book_id
            and b.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.books b
          where b.id = accounts.book_id
            and b.user_id = auth.uid()
        )
      );
  end if;

  -- Transactions
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_tenant_all'
  ) then
    create policy transactions_tenant_all
      on public.transactions
      for all
      using (
        exists (
          select 1 from public.books b
          where b.id = transactions.book_id
            and b.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.books b
          where b.id = transactions.book_id
            and b.user_id = auth.uid()
        )
      );
  end if;

  -- Transaction entries
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transaction_entries' and policyname = 'transaction_entries_tenant_all'
  ) then
    create policy transaction_entries_tenant_all
      on public.transaction_entries
      for all
      using (
        exists (
          select 1 from public.transactions t
          join public.books b on b.id = t.book_id
          where t.id = transaction_entries.transaction_id
            and b.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.transactions t
          join public.books b on b.id = t.book_id
          where t.id = transaction_entries.transaction_id
            and b.user_id = auth.uid()
        )
      );
  end if;

  -- Notes
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_tenant_all'
  ) then
    create policy notes_tenant_all
      on public.notes
      for all
      using (
        exists (
          select 1 from public.books b
          where b.id = notes.book_id
            and b.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.books b
          where b.id = notes.book_id
            and b.user_id = auth.uid()
        )
      );
  end if;

  -- Recycle bin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recycle_bin' and policyname = 'recycle_bin_tenant_all'
  ) then
    create policy recycle_bin_tenant_all
      on public.recycle_bin
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

commit;

