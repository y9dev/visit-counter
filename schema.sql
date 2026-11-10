-- Выполнить в Supabase: SQL Editor -> New query -> Run.
-- Скрипт подходит и для существующей таблицы из предыдущей версии.

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null default '/'
);

-- Миграция для ранее созданной таблицы: старые записи будут помечены как '/'
-- и не попадут в журнал, поскольку раньше путь не сохранялся.
alter table public.visits
  add column if not exists path text not null default '/';

alter table public.visits enable row level security;

-- Возвращает все уникальные пути, включая пути старше последних 500 записей.
create or replace function public.get_visit_paths()
returns table(path text)
language sql
security definer
set search_path = public
as $$
  select distinct v.path
  from public.visits as v
  where v.path <> '/'
  order by v.path;
$$;
