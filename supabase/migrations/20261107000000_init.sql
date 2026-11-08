-- Pipforge core schema. Run with `supabase db push` (or paste into the SQL editor).
-- Security model: every table has row level security on; browsers only hold the anon key.
-- Anything that touches money or status runs in a SECURITY DEFINER function or an Edge Function
-- using the service role, never directly from the browser.

-- ───────────── profiles ─────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  consent_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint profiles_phone_chk check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  constraint profiles_name_chk  check (full_name is null or char_length(full_name) between 2 and 60)
);

create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, '')) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- The only way a client writes name/phone/consent (so consent can never be skipped).
create function public.complete_profile(p_name text, p_phone text, p_consent boolean)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v  public.profiles;
  ph text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(p_name)) > 60 then
    raise exception 'invalid name' using errcode = '22023'; end if;
  if ph !~ '^\+?[0-9]{9,15}$' then raise exception 'invalid phone' using errcode = '22023'; end if;
  if not coalesce(p_consent, false) then raise exception 'consent required' using errcode = '22023'; end if;
  update public.profiles
     set full_name = trim(p_name), phone = ph, consent_at = coalesce(consent_at, now())
   where id = auth.uid()
   returning * into v;
  return v;
end $$;

-- ───────────── pricing (single source of truth) ─────────────
create table public.pricing (key text primary key, usd numeric(10,2) not null check (usd >= 0));
insert into public.pricing values ('setup', 200), ('connection', 10);

create table public.tld_prices (
  tld     text primary key check (tld ~ '^\.[a-z]+(\.[a-z]+)?$'),
  usd     numeric(10,2) not null check (usd >= 0),
  enabled boolean not null default true
);
insert into public.tld_prices (tld, usd) values
  ('.com',15),('.net',14),('.org',14),('.site',8),('.online',10),('.store',8),('.app',18),('.dev',14),
  ('.pro',15),('.live',12),('.xyz',4),('.co.ke',12),('.co.za',8),('.com.ng',12),('.co.uk',10),
  ('.in',8),('.ae',30),('.com.au',14),('.ca',15);

-- ───────────── sites ─────────────
create table public.sites (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null unique references auth.users(id) on delete cascade, -- one site per client for now
  name          text not null default 'My Trading Site' check (char_length(name) between 1 and 24),
  template      text not null default 'crimson' check (template = any (array['violet','crimson','midnight','snow','emerald','gold','ocean','mono','sapphire','amethyst','rose','sunset','lime','teal','graphite','ruby','cobalt','cloud','sand','mint'])),
  background    text not null default 'candles' check (background = any (array['candles','digits','pulse','arrows','ticker','coins','currency','moneyrain','waves','bars','radar','rings','digitgrid','spark','depth','gauge','network','ticks','trend','heatmap','img-chart','img-mesh','img-grid','img-digits','none'])),
  header        text not null default 'classic' check (header = any (array['classic','center','minimal','pill','banner','split'])),
  announcement  text not null default 'Free bots, updated weekly' check (char_length(announcement) <= 60),
  icon_shape    text not null default 'round' check (icon_shape = any (array['round','square','plain'])),
  icon_place    text not null default 'both'  check (icon_place = any (array['both','header','footer'])),
  social        jsonb not null default '{}'::jsonb check (jsonb_typeof(social) = 'object' and pg_column_size(social) < 4096),
  menu          jsonb not null default '{}'::jsonb check (jsonb_typeof(menu) = 'object' and pg_column_size(menu) < 2048),
  bot_mode      text not null default 'link' check (bot_mode = any (array['link','embed','none'])),
  embed_url     text check (embed_url is null or embed_url ~ '^https://[^\s]{1,500}$'),
  markup        numeric(3,1) not null default 1 check (markup between 0 and 3),
  deriv_app_id  text check (deriv_app_id is null or deriv_app_id ~ '^[0-9]{1,10}$'),
  referral_url  text check (referral_url is null or referral_url ~ '^https://[^\s]{1,500}$'),
  domain_mode   text not null default 'new' check (domain_mode in ('new','own')),
  domain        text check (domain is null or (char_length(domain) <= 253 and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$')),
  status        text not null default 'draft' check (status in ('draft','pending_payment','paid','provisioning','live','suspended')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- A domain can only be claimed by one site once checkout has started.
create unique index sites_domain_claim_uq on public.sites (lower(domain))
  where domain is not null and status in ('pending_payment','paid','provisioning','live');

create function public.sites_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  -- API roles (browser) cannot change ownership, status, or the domain after payment.
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.owner <> old.owner then raise exception 'owner cannot change' using errcode = '42501'; end if;
    if new.status <> old.status then raise exception 'status is managed by the system' using errcode = '42501'; end if;
    if old.status not in ('draft','pending_payment')
       and (new.domain is distinct from old.domain or new.domain_mode is distinct from old.domain_mode) then
      raise exception 'domain is locked after payment' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger sites_touch before update on public.sites for each row execute function public.sites_touch();

-- ───────────── orders & payments ─────────────
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references auth.users(id) on delete cascade,
  site_id        uuid not null references public.sites(id) on delete restrict,
  domain         text not null,
  domain_mode    text not null check (domain_mode in ('new','own')),
  setup_usd      numeric(10,2) not null,
  domain_usd     numeric(10,2) not null default 0,
  connection_usd numeric(10,2) not null default 0,
  total_usd      numeric(10,2) not null,
  status         text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  constraint orders_total_chk check (total_usd = setup_usd + domain_usd + connection_usd)
);
create index orders_owner_idx on public.orders (owner, created_at desc);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  provider     text not null check (provider in ('mpesa','card')),
  provider_ref text not null,           -- e.g. M-Pesa CheckoutRequestID
  amount_minor bigint not null check (amount_minor > 0),
  currency     text not null,
  status       text not null default 'initiated' check (status in ('initiated','succeeded','failed')),
  receipt      text,
  raw          jsonb,
  created_at   timestamptz not null default now(),
  unique (provider, provider_ref)
);

create table public.fulfilment_tasks (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  site_id  uuid not null references public.sites(id) on delete cascade,
  task     text not null check (task in ('register_domain','connect_dns','issue_ssl','go_live')),
  status   text not null default 'todo' check (status in ('todo','done')),
  notes    text,
  done_at  timestamptz,
  done_by  uuid references auth.users(id)
);

create table public.commission_daily (
  site_id   uuid not null references public.sites(id) on delete cascade,
  day       date not null,
  contracts integer not null default 0 check (contracts >= 0),
  volume    numeric(14,2) not null default 0,
  markup    numeric(14,2) not null default 0,
  primary key (site_id, day)
);

-- ───────────── ordering ─────────────
create function public.create_order(p_site uuid) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  s public.sites; o public.orders;
  setup numeric; conn numeric := 0; dom numeric := 0; t text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into s from public.sites where id = p_site and owner = auth.uid() for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if s.status not in ('draft','pending_payment') then raise exception 'site is already paid for' using errcode = '22023'; end if;
  if s.domain is null then raise exception 'choose a domain first' using errcode = '22023'; end if;

  select usd into setup from public.pricing where key = 'setup';
  if s.domain_mode = 'new' then
    select tld, usd into t, dom from public.tld_prices
     where enabled and s.domain like '%' || tld and char_length(s.domain) > char_length(tld) + 1
     order by char_length(tld) desc limit 1;
    if not found then raise exception 'unsupported domain ending' using errcode = '22023'; end if;
  else
    select usd into conn from public.pricing where key = 'connection';
  end if;

  update public.orders set status = 'cancelled' where site_id = s.id and status = 'pending';
  insert into public.orders (owner, site_id, domain, domain_mode, setup_usd, domain_usd, connection_usd, total_usd)
       values (s.owner, s.id, s.domain, s.domain_mode, setup, dom, conn, setup + dom + conn)
    returning * into o;
  update public.sites set status = 'pending_payment' where id = s.id;
  return o;
exception when unique_violation then
  raise exception 'domain is already taken' using errcode = '23505';
end $$;

-- Called only by the payment Edge Function (service role) after the provider confirms.
create function public.mark_order_paid(p_order uuid, p_provider text, p_ref text, p_receipt text)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if o.status = 'paid' then return o; end if;                    -- idempotent for repeated callbacks
  if o.status = 'refunded' then raise exception 'order refunded' using errcode = '22023'; end if;
  update public.orders set status = 'paid', paid_at = now() where id = p_order returning * into o;
  update public.sites set status = 'paid' where id = o.site_id and status in ('draft','pending_payment');
  insert into public.fulfilment_tasks (order_id, site_id, task)
    select o.id, o.site_id, x from unnest(
      case when o.domain_mode = 'new'
           then array['register_domain','connect_dns','issue_ssl','go_live']
           else array['connect_dns','issue_ssl','go_live'] end) as x;
  update public.payments set status = 'succeeded', receipt = p_receipt
   where provider = p_provider and provider_ref = p_ref;
  return o;
end $$;

-- Admin ticks off a fulfilment step; the site goes live when the last one is done.
create function public.admin_complete_task(p_task uuid, p_notes text default null) returns public.fulfilment_tasks
language plpgsql security definer set search_path = '' as $$
declare t public.fulfilment_tasks; left_ int;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  update public.fulfilment_tasks set status = 'done', done_at = now(), done_by = auth.uid(), notes = coalesce(p_notes, notes)
   where id = p_task returning * into t;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  select count(*) into left_ from public.fulfilment_tasks where site_id = t.site_id and status = 'todo';
  update public.sites set status = case when left_ = 0 then 'live' else 'provisioning' end
   where id = t.site_id and status in ('paid','provisioning');
  return t;
end $$;

-- Public, read-only view of a LIVE site's presentation settings (no owner or contact details).
create function public.public_site(p_domain text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', name, 'template', template, 'background', background, 'header', header,
    'announcement', announcement, 'icon_shape', icon_shape, 'icon_place', icon_place,
    'social', social, 'menu', menu, 'bot_mode', bot_mode, 'embed_url', embed_url,
    'markup', markup, 'deriv_app_id', deriv_app_id, 'referral_url', referral_url,
    'domain', domain, 'live_since', updated_at)
  from public.sites where lower(domain) = lower(p_domain) and status = 'live' limit 1
$$;

-- ───────────── row level security ─────────────
alter table public.profiles         enable row level security;
alter table public.admins           enable row level security;
alter table public.pricing          enable row level security;
alter table public.tld_prices       enable row level security;
alter table public.sites            enable row level security;
alter table public.orders           enable row level security;
alter table public.payments         enable row level security;
alter table public.fulfilment_tasks enable row level security;
alter table public.commission_daily enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy pricing_read on public.pricing    for select to anon, authenticated using (true);
create policy tld_read     on public.tld_prices for select to anon, authenticated using (enabled);

create policy sites_select on public.sites for select to authenticated
  using (owner = (select auth.uid()) or public.is_admin());
create policy sites_insert on public.sites for insert to authenticated
  with check (owner = (select auth.uid()));
create policy sites_update on public.sites for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy sites_delete on public.sites for delete to authenticated
  using (owner = (select auth.uid()) and status = 'draft');

create policy orders_select on public.orders for select to authenticated
  using (owner = (select auth.uid()) or public.is_admin());
create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.owner = (select auth.uid()) or public.is_admin())));
create policy tasks_select on public.fulfilment_tasks for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and (s.owner = (select auth.uid()) or public.is_admin())));
create policy commission_select on public.commission_daily for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and (s.owner = (select auth.uid()) or public.is_admin())));

-- ───────────── privileges (least privilege) ─────────────
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.pricing, public.tld_prices to anon, authenticated;
grant select on public.profiles, public.orders, public.payments, public.fulfilment_tasks, public.commission_daily to authenticated;
grant select, delete on public.sites to authenticated;
grant insert (owner, name, template, background, header, announcement, icon_shape, icon_place, social, menu,
              bot_mode, embed_url, markup, deriv_app_id, referral_url, domain_mode, domain) on public.sites to authenticated;
grant update (name, template, background, header, announcement, icon_shape, icon_place, social, menu,
              bot_mode, embed_url, markup, deriv_app_id, referral_url, domain_mode, domain) on public.sites to authenticated;

grant execute on function public.is_admin()                                  to authenticated;
grant execute on function public.complete_profile(text, text, boolean)       to authenticated;
grant execute on function public.create_order(uuid)                          to authenticated;
grant execute on function public.admin_complete_task(uuid, text)             to authenticated;
grant execute on function public.public_site(text)                           to anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, text, text)     to service_role;
grant all on all tables in schema public to service_role;
