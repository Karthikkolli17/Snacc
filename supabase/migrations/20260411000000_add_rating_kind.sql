alter table ratings
add column if not exists kind text not null default 'snack';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ratings_kind_check'
      and conrelid = 'ratings'::regclass
  ) then
    alter table ratings
    add constraint ratings_kind_check check (kind in ('snack', 'drink'));
  end if;
end $$;

create index if not exists ratings_kind_logged_at_idx
on ratings (kind, logged_at desc);
