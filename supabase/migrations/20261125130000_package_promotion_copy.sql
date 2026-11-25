alter table public.package_settings
  add column promo_heading text not null default 'Don’t miss your chance',
  add column promo_subheading text not null default 'Grants up to 20% off';

alter table public.package_settings
  add constraint package_settings_promo_heading_length check (char_length(promo_heading) between 1 and 80),
  add constraint package_settings_promo_subheading_length check (char_length(promo_subheading) between 1 and 100);

create or replace function public.package_prices() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('regular',case when offer_enabled and offer_ends_at>now() then regular_offer else regular_price end,
 'premium',case when offer_enabled and offer_ends_at>now() then premium_offer else premium_price end,
 'regular_standard',regular_price,'premium_standard',premium_price,
 'offer_active',offer_enabled and offer_ends_at>now(),'offer_ends_at',case when offer_enabled and offer_ends_at>now() then offer_ends_at end,
 'promo_heading',promo_heading,'promo_subheading',promo_subheading,
 'premium_available',(select count(*)>=19 from public.premium_bot_catalog c join public.premium_bot_sources b on b.bot_id=c.id where c.execution_ready)) from public.package_settings where id
$$;
