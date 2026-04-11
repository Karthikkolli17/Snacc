alter table ratings
add column if not exists country text;

create index if not exists ratings_country_idx
on ratings (country);
