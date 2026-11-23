-- Restore all editor choices and accept the newer header styles offered by the builder.
alter table public.sites drop constraint if exists sites_header_check;
alter table public.sites add constraint sites_header_check check (header = any (array[
  'classic','center','minimal','pill','banner','split','market','stacked','editorial','signal','edge','aurora','dock','slab','rail','focus','ticker','compact','brand','canvas','halo','corner','mono','social',
  'mobile','accountbar','balanced','brandline','social-row','account-focus'
]));

alter table public.sites drop constraint if exists sites_template_check;
alter table public.sites add constraint sites_template_check check (template = any (array[
  'violet','crimson','midnight','snow','emerald','gold','ocean','mono','sapphire','amethyst','rose','sunset','lime','teal','graphite','ruby','cobalt','cloud','sand','mint','aurora','saffron','ice','sakura','ultraviolet','forest','copper','obsidian','pearl','neon','lagoon','magma','royal','horizon','carbon',
  'market-cobalt','market-amethyst','market-jade','market-ruby','market-tangerine','market-electric-lime','market-sapphire','market-rosewood','market-silverline','market-turquoise'
]));

alter table public.sites drop constraint if exists sites_background_check;
alter table public.sites add constraint sites_background_check check (background = any (array[
  'candles','digits','pulse','arrows','ticker','coins','currency','moneyrain','waves','bars','radar','rings','digitgrid','spark','depth','gauge','network','ticks','trend','heatmap','orbit','bubbles','spiral','starfield','aurora','waveform','pulsegrid','comet','matrix','rain','radial','fan','hex','candleGlow','constellation','img-chart','img-mesh','img-grid','img-digits','none',
  'liquidity','breakout-live','sessions','candle-tape','orderflow-live','img-trade-0','img-trade-1','img-trade-2','img-trade-3','img-trade-4','img-trade-5','img-trade-6','img-trade-7','img-trade-8','img-trade-9',
  'petals','fireflies','tide','auroraVeil','starlight','img-botanical','img-sakura-paper','img-gingko','img-art-nouveau','img-terracotta','img-watercolor','img-wildflower','img-linen'
]));
