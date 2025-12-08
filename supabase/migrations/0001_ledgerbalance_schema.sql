begin;

-- Core books table (ledger)
create table if not exists public.books (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- Categories scoped to a book
create table if not exists public.categories (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_book_name_ci_idx
  on public.categories (book_id, lower(name));

-- Accounts belong to a book + category
create table if not exists public.accounts (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  category_id text not null references public.categories(id) on delete restrict,
  name text not null,
  opening_balance numeric,
  opening_balance_type text check (opening_balance_type in ('debit','credit')),
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_book_name_ci_idx
  on public.accounts (book_id, lower(name));

-- Header record per transaction
create table if not exists public.transactions (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  date timestamptz not null,
  description text not null,
  highlight text check (highlight in ('yellow','blue','strikethrough')),
  created_at timestamptz not null default now()
);

create index if not exists transactions_book_date_idx
  on public.transactions (book_id, date desc, created_at desc);

-- Individual debit/credit rows per transaction
create table if not exists public.transaction_entries (
  id text primary key,
  transaction_id text not null references public.transactions(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete restrict,
  amount numeric not null,
  type text not null check (type in ('debit','credit')),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists transaction_entries_tx_idx
  on public.transaction_entries (transaction_id);

create index if not exists transaction_entries_account_idx
  on public.transaction_entries (account_id);

-- Sticky notes / todos per book
create table if not exists public.notes (
  id text primary key,
  book_id text not null references public.books(id) on delete cascade,
  text text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notes_book_created_idx
  on public.notes (book_id, created_at desc);

-- Soft-delete store (JSON payload used for restore)
create table if not exists public.recycle_bin (
  id text primary key,
  entity_id text not null,
  entity_type text not null,
  payload jsonb not null,
  deleted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists recycle_bin_entity_idx
  on public.recycle_bin (entity_type, entity_id);

commit;



