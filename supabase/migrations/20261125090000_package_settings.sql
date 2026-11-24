alter table public.orders add column package text not null default 'regular' check(package in ('regular','premium'));
create table public.package_settings (
 id boolean primary key default true check(id),
 regular_price numeric(10,2) not null default 300 check(regular_price>0),
 premium_price numeric(10,2) not null default 450 check(premium_price>0),
 regular_offer numeric(10,2) not null default 200 check(regular_offer>0),
 premium_offer numeric(10,2) not null default 300 check(premium_offer>0),
 offer_enabled boolean not null default false,
 offer_ends_at timestamptz,
 telegram_url text not null default '' check(telegram_url='' or telegram_url ~ '^https://t\.me/[A-Za-z0-9_+/-]+$'),
 whatsapp_number text not null default '' check(whatsapp_number='' or whatsapp_number ~ '^[0-9]{8,15}$'),
 check(not offer_enabled or offer_ends_at is not null),
 check(regular_offer<=regular_price and premium_offer<=premium_price)
);
-- Keep the existing public price until an admin explicitly changes it.
insert into public.package_settings(id,regular_price) select true,usd from public.pricing where key='setup';
alter table public.package_settings enable row level security;
grant select,update on public.package_settings to authenticated;
create policy package_settings_admin on public.package_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create function public.package_prices() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('regular',case when offer_enabled and offer_ends_at>now() then regular_offer else regular_price end,
 'premium',case when offer_enabled and offer_ends_at>now() then premium_offer else premium_price end,
 'regular_standard',regular_price,'premium_standard',premium_price,
 'offer_active',offer_enabled and offer_ends_at>now(),'offer_ends_at',case when offer_enabled and offer_ends_at>now() then offer_ends_at end,
 'premium_available',false) from public.package_settings where id
$$;
revoke all on function public.package_prices() from public;
grant execute on function public.package_prices() to anon,authenticated;
create function public.premium_contacts() returns jsonb language sql stable security definer set search_path='' as $$
 select case when public.is_admin() or exists(select 1 from public.orders where owner=auth.uid() and status='paid' and package='premium')
 then jsonb_build_object('telegram_url',telegram_url,'whatsapp_number',whatsapp_number) else null end from public.package_settings where id
$$;
revoke all on function public.premium_contacts() from public,anon;
grant execute on function public.premium_contacts() to authenticated;

-- Domain registrations are paid directly by the client to their registrar.
-- Pipforge only takes payment for setup and connecting a client-owned domain.
create or replace function public.create_order(p_site uuid) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  s public.sites; o public.orders;
  setup numeric; conn numeric := 0;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into s from public.sites where id = p_site and owner = auth.uid() for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if s.status not in ('draft','pending_payment') then raise exception 'site is already paid for' using errcode = '22023'; end if;
  if s.domain is null then raise exception 'choose a domain first' using errcode = '22023'; end if;
  if s.domain_mode <> 'own' then
    raise exception 'buy the domain directly from your registrar, then enter it as a domain you own' using errcode = '22023';
  end if;

  select (public.package_prices()->>'regular')::numeric into setup;
  select usd into conn from public.pricing where key = 'connection';
  update public.orders set status = 'cancelled' where site_id = s.id and status = 'pending';
  insert into public.orders (owner, site_id, domain, domain_mode, setup_usd, domain_usd, connection_usd, total_usd)
       values (s.owner, s.id, s.domain, s.domain_mode, setup, 0, conn, setup + conn)
    returning * into o;
  update public.sites set status = 'pending_payment' where id = s.id;
  return o;
exception when unique_violation then
  raise exception 'domain is already taken' using errcode = '23505';
end $$;
