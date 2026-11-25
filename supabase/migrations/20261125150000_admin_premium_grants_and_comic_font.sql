-- Add the locally available Comic Sans font and audited admin Premium grants.
alter table public.sites drop constraint if exists sites_font_theme_check;
alter table public.sites add constraint sites_font_theme_check check (font_theme = any (array[
  'anton','bebas-neue','oswald','archivo-black','abril-fatface','righteous','orbitron','rajdhani','teko','caveat','patrick-hand','courgette','cinzel','special-elite','roboto-slab',
  'inter','dm-sans','manrope','space-grotesk','outfit','plus-jakarta','sora','urbanist','montserrat','lato',
  'roboto','open-sans','nunito','work-sans','rubik','poppins','raleway','figtree','onest','lexend',
  'ibm-plex','ibm-mono','space-mono','jetbrains','roboto-mono','source-sans','merriweather','lora','playfair','dm-serif',
  'cormorant','fraunces','libre-baskerville','pt-serif','barlow','comic-sans'
]));

create table public.site_premium_access_events (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  enabled boolean not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);
alter table public.site_premium_access_events enable row level security;
revoke all on public.site_premium_access_events from public, anon, authenticated;
grant select on public.site_premium_access_events to service_role;

create function public.site_has_premium_access(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    where o.site_id = p_site and o.status = 'paid' and o.package = 'premium'
  ) or coalesce((
    select e.enabled from public.site_premium_access_events e
    where e.site_id = p_site order by e.id desc limit 1
  ), false)
$$;
revoke all on function public.site_has_premium_access(uuid) from public, anon, authenticated;

create function public.admin_site_premium_access()
returns table(site_id uuid, paid_premium boolean, admin_granted boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select s.id,
    exists(select 1 from public.orders o where o.site_id=s.id and o.status='paid' and o.package='premium'),
    coalesce((select e.enabled from public.site_premium_access_events e where e.site_id=s.id order by e.id desc limit 1), false)
  from public.sites s;
end $$;
revoke all on function public.admin_site_premium_access() from public, anon;
grant execute on function public.admin_site_premium_access() to authenticated;

create function public.set_site_premium_grant(p_site uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare current_value boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_enabled is null then raise exception 'choose grant or revoke' using errcode = '22023'; end if;
  if not exists(select 1 from public.sites where id=p_site) then raise exception 'site not found' using errcode = 'P0002'; end if;
  if not p_enabled and exists(select 1 from public.orders where site_id=p_site and status='paid' and package='premium') then
    raise exception 'paid Premium access cannot be revoked here' using errcode = '22023';
  end if;
  select e.enabled into current_value from public.site_premium_access_events e
    where e.site_id=p_site order by e.id desc limit 1;
  if not found or current_value is distinct from p_enabled then
    insert into public.site_premium_access_events(site_id,enabled,changed_by)
      values(p_site,p_enabled,auth.uid());
  end if;
end $$;
revoke all on function public.set_site_premium_grant(uuid,boolean) from public, anon;
grant execute on function public.set_site_premium_grant(uuid,boolean) to authenticated;

create or replace function public.package_prices() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'regular',case when offer_enabled and offer_ends_at>now() then regular_offer else regular_price end,
    'premium',case when offer_enabled and offer_ends_at>now() then premium_offer else premium_price end,
    'regular_standard',regular_price,'premium_standard',premium_price,
    'regular_discount',case when offer_enabled and offer_ends_at>now() and regular_offer<regular_price then round((regular_price-regular_offer)*100/regular_price)::integer else 0 end,
    'premium_discount',case when offer_enabled and offer_ends_at>now() and premium_offer<premium_price then round((premium_price-premium_offer)*100/premium_price)::integer else 0 end,
    'offer_active',offer_enabled and offer_ends_at>now(),
    'offer_ends_at',case when offer_enabled and offer_ends_at>now() then offer_ends_at end,
    'promo_heading',promo_heading,'promo_subheading',promo_subheading,
    'premium_available',(select count(*)>=19 from public.premium_bot_catalog c join public.premium_bot_sources b on b.bot_id=c.id where c.execution_ready)
  ) from public.package_settings where id
$$;

create or replace function public.public_site(p_domain text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(s)) where key=any(array[
    'name','logo_data','loader_style','blur','template','background','header','font_theme','announcement','icon_shape','icon_place','social','menu','bot_mode','embed_url','markup','deriv_app_id','referral_url','domain'
  ])) || jsonb_build_object('live_since',s.updated_at,'premium_enabled',public.site_has_premium_access(s.id))
  from public.sites s where lower(s.domain)=lower(p_domain) and s.status='live' limit 1
$$;

create or replace function public.premium_contacts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() or exists(
    select 1 from public.sites s where s.owner=auth.uid() and public.site_has_premium_access(s.id)
  ) then jsonb_build_object('telegram_url',telegram_url,'whatsapp_number',whatsapp_number) else null end
  from public.package_settings where id
$$;

create or replace function public.set_premium_bot_access(p_site uuid,p_bot text,p_account text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode='28000'; end if;
  if not exists(select 1 from public.sites s where s.id=p_site and s.owner=auth.uid() and s.status='live' and public.site_has_premium_access(s.id)) then
    raise exception 'A Premium site owner is required' using errcode='42501';
  end if;
  if p_enabled is null then raise exception 'choose grant or revoke' using errcode='22023'; end if;
  insert into public.premium_bot_grants(site_id,bot_id,account_id,granted_by,revoked_at)
  values(p_site,p_bot,p_account,auth.uid(),case when p_enabled then null else now() end)
  on conflict(site_id,bot_id,account_id) do update set granted_by=auth.uid(),granted_at=now(),revoked_at=case when p_enabled then null else now() end;
end $$;
