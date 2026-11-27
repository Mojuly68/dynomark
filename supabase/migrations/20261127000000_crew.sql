-- DYNOMARK Crew: friends see each other's posted session summaries. No comments, ever.
-- The full climbing log stays on the phone; only what a climber posts is stored here.
-- Every table has row-level security: the database itself decides who can read what.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Profiles: the only public part of an account (username, optional first name, home gym).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  first_name text check (first_name is null or char_length(first_name) between 1 and 30),
  home_gym text check (home_gym is null or char_length(home_gym) <= 60),
  created_at timestamptz not null default now()
);

-- Names nobody may take (staff look-alikes and obvious abuse). The app filters more before sending.
create table public.reserved_usernames (name citext primary key);
insert into public.reserved_usernames (name) values
  ('admin'), ('administrator'), ('dynomark'), ('dynomark_app'), ('support'), ('help'), ('staff'), ('moderator'),
  ('official'), ('studiovektor'), ('studio_vektor'), ('apple'), ('root'), ('system'), ('null'), ('undefined');

create or replace function public.check_username() returns trigger language plpgsql as $$
begin
  new.username := lower(new.username);
  if exists (select 1 from public.reserved_usernames r where r.name = new.username) then
    raise exception 'username_reserved' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger profiles_username before insert or update of username on public.profiles
  for each row execute function public.check_username();

-- ---------------------------------------------------------------------------
-- Friendships: a request (pending) that the other climber accepts. Stored once per pair.
-- ---------------------------------------------------------------------------
create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- Blocking ends any friendship or request between the two.
create or replace function public.on_block() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where (requester = new.blocker and addressee = new.blocked) or (requester = new.blocked and addressee = new.blocker);
  return new;
end $$;
create trigger blocks_end_friendship after insert on public.blocks for each row execute function public.on_block();

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- Only answers for the signed-in climber's own pairs, so nobody can probe other people's blocks.
  select auth.uid() in (a, b)
     and exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() in (a, b) and exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  ) and not public.is_blocked_between(a, b);
$$;

-- ---------------------------------------------------------------------------
-- Posts: a summary the climber chose to share. `data` holds only the fields they switched on.
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('session', 'training')),
  local_ref text not null check (char_length(local_ref) <= 64),
  data jsonb not null check (pg_column_size(data) <= 4000),
  created_at timestamptz not null default now(),
  unique (author, local_ref)
);
create index posts_author_created on public.posts (author, created_at desc);

create table public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('allez', 'send', 'crusher', 'clean', 'respect')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

-- Reports go to the studio; nobody can read them through the app.
create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references public.profiles (id) on delete cascade,
  reported uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.reserved_usernames enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;

-- Profiles: signed-in climbers can look up usernames (search, invites), except people who blocked them.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or not public.is_blocked_between(auth.uid(), id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Friendships: only the two people involved see a row. Only the requester creates it (pending),
-- only the addressee can accept, and either can end it.
create policy friendships_read on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
create policy friendships_request on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending' and not public.is_blocked_between(requester, addressee));
-- No update policy: accepting goes through accept_friend(), which can only flip the addressee's own pending row.
create policy friendships_end on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

create policy blocks_own on public.blocks for all to authenticated
  using (blocker = auth.uid()) with check (blocker = auth.uid());

-- Posts: you and your accepted friends. Posts can be deleted, never edited.
create policy posts_read on public.posts for select to authenticated
  using (author = auth.uid() or public.are_friends(auth.uid(), author));
create policy posts_create on public.posts for insert to authenticated with check (author = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (author = auth.uid());

-- Reactions: visible and allowed on posts you can see.
create policy reactions_read on public.reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy reactions_add on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy reactions_remove on public.reactions for delete to authenticated using (user_id = auth.uid());

create policy reports_create on public.reports for insert to authenticated with check (reporter = auth.uid());

create or replace function public.accept_friend(from_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.friendships set status = 'accepted', accepted_at = now()
   where requester = from_user and addressee = auth.uid() and status = 'pending'
     and not public.is_blocked_between(from_user, auth.uid());
$$;
revoke all on function public.accept_friend(uuid) from public, anon;
grant execute on function public.accept_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Delete my Crew account (Apple requires in-app deletion). Removes the auth user; everything else cascades.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

revoke all on function public.are_friends(uuid, uuid) from public, anon;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
