begin;

-- 1. Add user_id to books (linked to auth.users)
alter table public.books
  add column if not exists user_id uuid;

-- 2. Add user_id to recycle_bin to simplify RLS (optional but recommended)
alter table public.recycle_bin
  add column if not exists user_id uuid;

-- 3. Backfill user_id for existing rows.
-- NOTE: You MUST replace the placeholder value below with a real auth.users.id
-- before running this migration in a real environment.
do $$
declare
  legacy_owner uuid := '2da0bc7c-a8b3-405d-9e19-d6f05fd2bc56';
begin
  if legacy_owner = '00000000-0000-0000-0000-000000000000' then
    raise exception
      using message = 'Set legacy_owner in 0002_multi_user_schema.sql to the auth.users.id that should own existing data before running this migration.';
  end if;

  -- Backfill books.user_id where missing
  update public.books
  set user_id = coalesce(user_id, legacy_owner)
  where user_id is null;

  -- Backfill recycle_bin.user_id for existing items.
  -- Since all existing data belongs to the legacy single user, we can safely
  -- assign any null user_id values to legacy_owner.
  update public.recycle_bin
  set user_id = coalesce(user_id, legacy_owner)
  where user_id is null;
end
$$;

-- 4. Enforce NOT NULL and add indexes
alter table public.books
  alter column user_id set not null;

create index if not exists books_user_id_idx
  on public.books(user_id);

alter table public.recycle_bin
  alter column user_id set not null;

create index if not exists recycle_bin_user_id_idx
  on public.recycle_bin(user_id);

commit;

