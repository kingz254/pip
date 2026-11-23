-- Keep the font selector and sites.font_theme validation in sync.
alter table public.sites drop constraint if exists sites_font_theme_check;
alter table public.sites add constraint sites_font_theme_check check (font_theme = any (array[
  'anton','bebas-neue','oswald','archivo-black','abril-fatface','righteous','orbitron','rajdhani','teko','caveat','patrick-hand','courgette','cinzel','special-elite','roboto-slab',
  'inter','dm-sans','manrope','space-grotesk','outfit','plus-jakarta','sora','urbanist','montserrat','lato',
  'roboto','open-sans','nunito','work-sans','rubik','poppins','raleway','figtree','onest','lexend',
  'ibm-plex','ibm-mono','space-mono','jetbrains','roboto-mono','source-sans','merriweather','lora','playfair','dm-serif',
  'cormorant','fraunces','libre-baskerville','pt-serif','barlow'
]));
