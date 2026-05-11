alter table if exists ratings enable row level security;
alter table if exists users enable row level security;

drop policy if exists ratings_public_read on ratings;
create policy ratings_public_read
on ratings
for select
using (true);

drop view if exists user_profiles;

create view user_profiles as
select
  id,
  username,
  credential_id is not null as has_passkey,
  pin_hash is not null as has_pin
from users;

grant select on user_profiles to anon, authenticated;
