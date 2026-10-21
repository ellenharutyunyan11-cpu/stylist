-- Stylist: wardrobes and saved outfits in Supabase.
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
-- Security: row-level security (RLS) is on for both tables and for the photo bucket.
-- A signed-in person can only read, add, change or delete their own rows and photos.
-- People who aren't signed in (the public "anon" key in the page) get no access at all.

-- ---------- Clothing items ----------
create table if not exists public.wardrobe_items (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null check (char_length(id) between 1 and 40),
  name        text not null check (char_length(name) between 1 and 60),
  category    text not null check (category in ('top','bottom','dress','outerwear','shoes','accessory')),
  kind        text check (char_length(kind) <= 20),
  color       text check (char_length(color) <= 60),
  hex         text check (hex ~ '^#[0-9a-fA-F]{6}$'),
  pattern     text check (char_length(pattern) <= 20),
  style       text check (char_length(style) <= 20),
  occasions   text[] not null default '{}' check (cardinality(occasions) <= 10),
  photo_path  text check (char_length(photo_path) <= 200),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- Saved outfits ----------
create table if not exists public.saved_outfits (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null check (char_length(id) between 1 and 40),
  title       text not null check (char_length(title) between 1 and 60),
  why         text check (char_length(why) <= 1000),
  occasion    text check (char_length(occasion) <= 20),
  item_ids    text[] not null default '{}' check (cardinality(item_ids) <= 12),
  find_name   text check (char_length(find_name) <= 80),
  find_path   text check (char_length(find_path) <= 200),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- Only signed-in users may touch these tables, and RLS limits them to their own rows.
revoke all on public.wardrobe_items, public.saved_outfits from anon;
grant select, insert, update, delete on public.wardrobe_items, public.saved_outfits to authenticated;

alter table public.wardrobe_items enable row level security;
alter table public.saved_outfits  enable row level security;

drop policy if exists "Own items: read"    on public.wardrobe_items;
drop policy if exists "Own items: add"     on public.wardrobe_items;
drop policy if exists "Own items: change"  on public.wardrobe_items;
drop policy if exists "Own items: remove"  on public.wardrobe_items;
create policy "Own items: read"   on public.wardrobe_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own items: add"    on public.wardrobe_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own items: change" on public.wardrobe_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own items: remove" on public.wardrobe_items for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Own outfits: read"   on public.saved_outfits;
drop policy if exists "Own outfits: add"    on public.saved_outfits;
drop policy if exists "Own outfits: change" on public.saved_outfits;
drop policy if exists "Own outfits: remove" on public.saved_outfits;
create policy "Own outfits: read"   on public.saved_outfits for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own outfits: add"    on public.saved_outfits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own outfits: change" on public.saved_outfits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own outfits: remove" on public.saved_outfits for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Photos ----------
-- Private bucket: photos are only reachable through short-lived signed links made for their owner.
-- Each user's files live in a folder named after their user id: <user id>/item-<id>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Wardrobe photos: own read"   on storage.objects;
drop policy if exists "Wardrobe photos: own add"    on storage.objects;
drop policy if exists "Wardrobe photos: own change" on storage.objects;
drop policy if exists "Wardrobe photos: own remove" on storage.objects;
create policy "Wardrobe photos: own read"   on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Wardrobe photos: own add"    on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Wardrobe photos: own change" on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Wardrobe photos: own remove" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
