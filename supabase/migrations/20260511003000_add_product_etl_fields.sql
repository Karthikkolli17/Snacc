alter table products
  add column if not exists display_name text,
  add column if not exists display_brand text,
  add column if not exists search_text text,
  add column if not exists quality_score integer not null default 0,
  add column if not exists quality_notes text[] not null default '{}',
  add column if not exists is_searchable boolean not null default false,
  add column if not exists processed_at timestamptz;

create index if not exists products_searchable_kind_idx
on products (kind, is_searchable, quality_score desc);

create index if not exists products_search_text_idx
on products using gin (to_tsvector('simple', coalesce(search_text, '')));
