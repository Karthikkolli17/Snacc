create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('open_food_facts', 'usda')),
  source_id text not null,
  barcode text,
  kind text not null default 'snack' check (kind in ('snack', 'drink')),
  name text not null,
  brand text,
  image text,
  country text,
  categories text[] not null default '{}',
  nutrition jsonb,
  raw jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists products_kind_name_idx on products (kind, name);
create index if not exists products_barcode_idx on products (barcode);
create index if not exists products_country_idx on products (country);

alter table products enable row level security;

drop policy if exists products_public_read on products;
create policy products_public_read
on products
for select
using (true);
