create table public.premium_bot_sources (
 bot_id text primary key references public.premium_bot_catalog(id),
 xml_content text not null check(octet_length(xml_content)<2000000)
);
alter table public.premium_bot_sources enable row level security;
revoke all on public.premium_bot_sources from public,anon,authenticated;
grant select,insert,update on public.premium_bot_sources to service_role;
-- This marker means browser compatibility is approved, not profitable or risk-free.
update public.premium_bot_catalog set execution_ready=false;

create or replace function public.package_prices() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('regular',case when offer_enabled and offer_ends_at>now() then regular_offer else regular_price end,
 'premium',case when offer_enabled and offer_ends_at>now() then premium_offer else premium_price end,
 'regular_standard',regular_price,'premium_standard',premium_price,
 'offer_active',offer_enabled and offer_ends_at>now(),'offer_ends_at',case when offer_enabled and offer_ends_at>now() then offer_ends_at end,
 'premium_available',(select count(*)>=19 from public.premium_bot_catalog c join public.premium_bot_sources b on b.bot_id=c.id where c.execution_ready)) from public.package_settings where id
$$;
create or replace function public.public_site(p_domain text) returns jsonb language sql stable security definer set search_path='' as $$
 select (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(s)) where key=any(array[
 'name','logo_data','loader_style','blur','template','background','header','font_theme','announcement','icon_shape','icon_place','social','menu','bot_mode','embed_url','markup','deriv_app_id','referral_url','domain'
 ])) || jsonb_build_object('live_since',s.updated_at,'premium_enabled',exists(select 1 from public.orders o where o.site_id=s.id and o.status='paid' and o.package='premium'))
 from public.sites s where lower(s.domain)=lower(p_domain) and s.status='live' limit 1
$$;
