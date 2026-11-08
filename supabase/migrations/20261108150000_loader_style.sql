alter table public.sites
  add column loader_style text not null default 'ring'
  check (loader_style = any (array[
    'ring','pulse','dots','bars','wave','bounce','ripple','orbit','dual','scan',
    'blocks','spinner','glow','equalizer','flip','dots-ring','sweep','steps','comet','bars-wave'
  ]));

grant insert (loader_style) on public.sites to authenticated;
grant update (loader_style) on public.sites to authenticated;

create or replace function public.public_site(p_domain text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', name, 'logo_data', logo_data, 'loader_style', loader_style,
    'template', template, 'background', background, 'header', header,
    'font_theme', font_theme, 'announcement', announcement, 'icon_shape', icon_shape, 'icon_place', icon_place,
    'social', social, 'menu', menu, 'bot_mode', bot_mode, 'embed_url', embed_url,
    'markup', markup, 'deriv_app_id', deriv_app_id, 'referral_url', referral_url,
    'domain', domain, 'live_since', updated_at)
  from public.sites where lower(domain) = lower(p_domain) and status = 'live' limit 1
$$;
