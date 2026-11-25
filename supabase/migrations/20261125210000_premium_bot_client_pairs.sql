create table public.premium_bot_clients (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  client_name text not null check (length(btrim(client_name)) between 1 and 120),
  real_account_id text not null check (real_account_id ~ '^(ROT|CR)[A-Za-z0-9_-]{1,61}$'),
  demo_account_id text not null check (demo_account_id ~ '^(DOT|VRTC)[A-Za-z0-9_-]{1,59}$'),
  bots_enabled boolean not null default true,
  added_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, real_account_id),
  unique (site_id, demo_account_id)
);

alter table public.premium_bot_clients enable row level security;
revoke all on public.premium_bot_clients from public, anon, authenticated;
grant select, insert, update, delete on public.premium_bot_clients to service_role;

create function public.list_premium_bot_clients(p_site uuid)
returns table (
  id uuid,
  client_name text,
  real_account_id text,
  demo_account_id text,
  bots_enabled boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.sites s
    where s.id = p_site and s.owner = auth.uid() and s.status = 'live'
      and public.site_has_premium_access(s.id)
  ) then
    raise exception 'A live Premium site owner is required' using errcode = '42501';
  end if;
  return query
    select c.id, c.client_name, c.real_account_id, c.demo_account_id, c.bots_enabled, c.created_at
    from public.premium_bot_clients c
    where c.site_id = p_site
    order by c.created_at desc, c.client_name asc;
end
$$;

create function public.grant_premium_bot_client(
  p_site uuid,
  p_client_name text,
  p_real_account_id text,
  p_demo_account_id text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_id uuid;
  previous_demo_id text;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_client_name is null or length(btrim(p_client_name)) not between 1 and 120 then
    raise exception 'enter the client name' using errcode = '22023';
  end if;
  if p_real_account_id is null or p_real_account_id !~ '^(ROT|CR)[A-Za-z0-9_-]{1,61}$' then
    raise exception 'real Deriv Options IDs must start with ROT or CR' using errcode = '22023';
  end if;
  if p_demo_account_id is null or p_demo_account_id !~ '^(DOT|VRTC)[A-Za-z0-9_-]{1,59}$' then
    raise exception 'demo Deriv Options IDs must start with DOT or VRTC' using errcode = '22023';
  end if;
  if p_real_account_id = p_demo_account_id then
    raise exception 'real and demo account IDs must be different' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.sites s
    where s.id = p_site and s.owner = auth.uid() and s.status = 'live'
      and public.site_has_premium_access(s.id)
  ) then
    raise exception 'A live Premium site owner is required' using errcode = '42501';
  end if;

  select c.demo_account_id into previous_demo_id
    from public.premium_bot_clients c
    where c.site_id = p_site and c.real_account_id = p_real_account_id
    for update;
  if previous_demo_id is not null and previous_demo_id <> p_demo_account_id then
    update public.premium_bot_grants
      set revoked_at = now()
      where site_id = p_site and account_id = previous_demo_id and revoked_at is null;
  end if;

  insert into public.premium_bot_clients(site_id, client_name, real_account_id, demo_account_id, bots_enabled, added_by)
  values (p_site, btrim(p_client_name), p_real_account_id, p_demo_account_id, true, auth.uid())
  on conflict (site_id, real_account_id) do update
    set client_name = excluded.client_name,
        demo_account_id = excluded.demo_account_id,
        bots_enabled = true,
        added_by = auth.uid(),
        updated_at = now()
  returning id into client_id;

  insert into public.premium_bot_grants(site_id, bot_id, account_id, granted_by, revoked_at)
  select p_site, bot.id, account.account_id, auth.uid(), null
    from public.premium_bot_catalog bot
    cross join (values (p_real_account_id), (p_demo_account_id)) as account(account_id)
  on conflict (site_id, bot_id, account_id) do update
    set granted_by = auth.uid(), granted_at = now(), revoked_at = null;

  return client_id;
end
$$;

create function public.set_premium_bot_client_access(
  p_site uuid,
  p_client uuid,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  client public.premium_bot_clients%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_enabled is null then
    raise exception 'choose grant or revoke' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.sites s
    where s.id = p_site and s.owner = auth.uid() and s.status = 'live'
      and public.site_has_premium_access(s.id)
  ) then
    raise exception 'A live Premium site owner is required' using errcode = '42501';
  end if;
  select c.* into client from public.premium_bot_clients c
    where c.id = p_client and c.site_id = p_site for update;
  if not found then
    raise exception 'Premium client not found' using errcode = 'P0002';
  end if;

  if p_enabled then
    insert into public.premium_bot_grants(site_id, bot_id, account_id, granted_by, revoked_at)
    select p_site, bot.id, account.account_id, auth.uid(), null
      from public.premium_bot_catalog bot
      cross join (values (client.real_account_id), (client.demo_account_id)) as account(account_id)
    on conflict (site_id, bot_id, account_id) do update
      set granted_by = auth.uid(), granted_at = now(), revoked_at = null;
  else
    update public.premium_bot_grants
      set revoked_at = now()
      where site_id = p_site
        and account_id in (client.real_account_id, client.demo_account_id)
        and revoked_at is null;
  end if;

  update public.premium_bot_clients
    set bots_enabled = p_enabled, updated_at = now()
    where id = p_client and site_id = p_site;
end
$$;

revoke all on function public.list_premium_bot_clients(uuid) from public, anon;
grant execute on function public.list_premium_bot_clients(uuid) to authenticated;
revoke all on function public.grant_premium_bot_client(uuid, text, text, text) from public, anon;
grant execute on function public.grant_premium_bot_client(uuid, text, text, text) to authenticated;
revoke all on function public.set_premium_bot_client_access(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_premium_bot_client_access(uuid, uuid, boolean) to authenticated;
