alter table public.sites
  alter column loader_style set default 'spinner',
  drop constraint if exists sites_loader_style_check;

alter table public.sites
  add constraint sites_loader_style_check check (loader_style = any (array[
    'bars','bounce','dual','scan','blocks','spinner','flip','sweep',
    'dots-15','dots-14','dots-bars-4','dots-bars-6','progress-5','progress-19',
    'wobbling-12','squishy-9','rolling-8','pulsing-10','arcade-4','arcade-5',
    'nature-12','time-5','hungry-1','shuriken-10','eyes-6','eyes-7','cut-9',
    'arrow-8','arrow-7','factory-7','factory-8',
    'bars-20','spinner-30','wobbling-20','wavy-12','wavy-15','squishy-1',
    'pulsing-8','nature-4','shuriken-9','cut-8','blob-12','blob-14','blob-19'
  ]));
