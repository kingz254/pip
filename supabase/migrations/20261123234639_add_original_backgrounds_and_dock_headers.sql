-- Register the original design options while retaining every ID already saved by a client.
alter table public.sites drop constraint if exists sites_background_check;
alter table public.sites add constraint sites_background_check check (background = any (array[
  'candles','digits','pulse','arrows','ticker','coins','currency','moneyrain','waves','bars','radar','rings','digitgrid','spark','depth','gauge','network','ticks','trend','heatmap','orbit','bubbles','spiral','starfield','aurora','waveform','pulsegrid','comet','matrix','rain','radial','fan','hex','candleGlow','constellation','img-chart','img-mesh','img-grid','img-digits','none',
  'liquidity','breakout-live','sessions','candle-tape','orderflow-live','img-trade-0','img-trade-1','img-trade-2','img-trade-3','img-trade-4','img-trade-5','img-trade-6','img-trade-7','img-trade-8','img-trade-9',
  'petals','fireflies','tide','auroraVeil','starlight','img-botanical','img-sakura-paper','img-gingko','img-art-nouveau','img-terracotta','img-watercolor','img-wildflower','img-linen',
  'img-bougainvillea','img-checker-weave','img-cloudbank','img-ceramic','img-fan-palm','img-marbled-stone','img-moon-phase','img-origami','img-sunprint','img-tulip',
  'motion-breeze','motion-candlelight','motion-cloud-drift','motion-dusk-bloom','motion-ink-wash','motion-koi-glide','motion-prism-shift','motion-silk-current','motion-slow-orbit','motion-tidal-glass'
]));

alter table public.sites drop constraint if exists sites_header_check;
alter table public.sites add constraint sites_header_check check (header = any (array[
  'classic','center','minimal','pill','banner','split','market','stacked','editorial','signal','edge','aurora','dock','slab','rail','focus','ticker','compact','brand','canvas','halo','corner','mono','social',
  'mobile','accountbar','balanced','brandline','social-row','account-focus',
  'dock-arc','dock-capsule','dock-frost','dock-island','dock-orbit','dock-shelf','dock-soft','dock-spring','dock-stacked','dock-underline'
]));
