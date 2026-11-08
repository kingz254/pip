alter table public.sites
  add column font_theme text not null default 'inter'
  check (font_theme = any (array[
    'inter','dm-sans','manrope','space-grotesk','outfit','plus-jakarta','sora','urbanist','montserrat','lato',
    'roboto','open-sans','nunito','work-sans','rubik','poppins','raleway','figtree','onest','lexend',
    'ibm-plex','ibm-mono','space-mono','jetbrains','roboto-mono','source-sans','merriweather','lora','playfair','dm-serif',
    'cormorant','fraunces','libre-baskerville','pt-serif','barlow'
  ]));

grant insert (font_theme) on public.sites to authenticated;
grant update (font_theme) on public.sites to authenticated;

alter table public.sites drop constraint sites_header_check;
alter table public.sites add constraint sites_header_check check (header = any (array[
  'classic','center','minimal','pill','banner','split','market','stacked','editorial','signal','edge','aurora','dock',
  'slab','rail','focus','ticker','compact','brand','canvas','halo','corner','mono','social'
]));

create or replace function public.public_site(p_domain text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', name, 'template', template, 'background', background, 'header', header,
    'font_theme', font_theme, 'announcement', announcement, 'icon_shape', icon_shape, 'icon_place', icon_place,
    'social', social, 'menu', menu, 'bot_mode', bot_mode, 'embed_url', embed_url,
    'markup', markup, 'deriv_app_id', deriv_app_id, 'referral_url', referral_url,
    'domain', domain, 'live_since', updated_at)
  from public.sites where lower(domain) = lower(p_domain) and status = 'live' limit 1
$$;
