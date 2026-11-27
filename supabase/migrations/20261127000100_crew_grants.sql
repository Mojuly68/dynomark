-- Newer Supabase projects don't grant table access to the API roles by default.
-- Signed-in climbers get exactly what the app needs; row-level security still decides which rows.
-- Signed-out visitors (anon) get nothing.

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant insert on public.reports to authenticated;

-- Re-posting a session replaces its summary (the app upserts on author + local_ref), so authors may update their own posts.
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author = auth.uid()) with check (author = auth.uid());

-- The reserved-name check must read reserved_usernames, which climbers can't read directly.
alter function public.check_username() security definer;
alter function public.check_username() set search_path = public;

-- Hardening: the API never needs these, and TRUNCATE would ignore row-level security.
revoke truncate, references, trigger on public.profiles, public.friendships, public.blocks, public.posts,
  public.reactions, public.reports, public.reserved_usernames from anon, authenticated;
