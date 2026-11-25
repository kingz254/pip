create table if not exists public.pipforge_site_background (
  id boolean primary key default true check (id),
  object_path text,
  media_kind text,
  updated_at timestamptz not null default now(),
  constraint pipforge_site_background_media_pair check (
    (object_path is null and media_kind is null)
    or (object_path is not null and media_kind in ('image', 'video'))
  )
);

insert into public.pipforge_site_background (id, object_path, media_kind)
values (true, null, null)
on conflict (id) do nothing;

alter table public.pipforge_site_background enable row level security;
revoke all on public.pipforge_site_background from anon, authenticated;
grant select on public.pipforge_site_background to anon, authenticated;
grant update (object_path, media_kind, updated_at) on public.pipforge_site_background to authenticated;

drop policy if exists pipforge_background_public_read on public.pipforge_site_background;
create policy pipforge_background_public_read
  on public.pipforge_site_background for select
  to anon, authenticated
  using (true);

drop policy if exists pipforge_background_admin_update on public.pipforge_site_background;
create policy pipforge_background_admin_update
  on public.pipforge_site_background for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pipforge-backgrounds',
  'pipforge-backgrounds',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pipforge_background_admin_upload on storage.objects;
create policy pipforge_background_admin_upload
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pipforge-backgrounds' and (select public.is_admin()));

drop policy if exists pipforge_background_admin_delete on storage.objects;
create policy pipforge_background_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pipforge-backgrounds' and (select public.is_admin()));
