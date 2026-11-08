-- Expand the client-facing design library and keep allowed values enforced in Postgres.
alter table public.sites drop constraint sites_template_check;
alter table public.sites add constraint sites_template_check check (template = any (array[
  'violet','crimson','midnight','snow','emerald','gold','ocean','mono','sapphire','amethyst','rose','sunset','lime','teal','graphite','ruby','cobalt','cloud','sand','mint',
  'aurora','saffron','ice','sakura','ultraviolet','forest','copper','obsidian','pearl','neon','lagoon','magma','royal','horizon','carbon'
]));

alter table public.sites drop constraint sites_background_check;
alter table public.sites add constraint sites_background_check check (background = any (array[
  'candles','digits','pulse','arrows','ticker','coins','currency','moneyrain','waves','bars','radar','rings','digitgrid','spark','depth','gauge','network','ticks','trend','heatmap',
  'orbit','bubbles','spiral','starfield','aurora','waveform','pulsegrid','comet','matrix','rain','radial','fan','hex','candleGlow','constellation',
  'img-chart','img-mesh','img-grid','img-digits','none'
]));

-- Country-market domain endings offered in the builder. Prices are editable in this table.
insert into public.tld_prices (tld, usd) values
  ('.com.gh',12),('.co.ug',12),('.co.tz',12),('.co.zm',12),('.co.zw',12),
  ('.com.br',12),('.com.mx',12),('.com.pk',12),('.com.bd',12),('.co.id',12),
  ('.com.ph',12),('.com.my',12),('.co.th',12),('.com.vn',12),('.com.tr',12),
  ('.com.eg',12),('.co.ma',12),('.com.ar',12),('.com.co',12),('.com.pe',12),
  ('.co.jp',12),('.co.kr',12)
on conflict (tld) do update set enabled = true;
