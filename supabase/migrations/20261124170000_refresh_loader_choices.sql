alter table public.sites
  alter column loader_style set default 'spinner-30',
  drop constraint if exists sites_loader_style_check;

update public.sites set loader_style = 'spinner-30'
where loader_style not in (
  'dots-15','dots-14','bars-20','dots-bars-4','dots-bars-6','spinner-30',
  'progress-5','progress-19','wobbling-12','wobbling-20','wavy-12','wavy-15',
  'squishy-1','squishy-9','rolling-8','pulsing-10','pulsing-8','arcade-4','arcade-5',
  'nature-4','nature-12','time-5','hungry-1','shuriken-9','shuriken-10','eyes-6','eyes-7',
  'cut-9','cut-8','arrow-8','arrow-7','blob-12','blob-14','blob-19','factory-7','factory-8'
);

alter table public.sites
  add constraint sites_loader_style_check check (loader_style = any (array[
    'dots-15','dots-14','bars-20','dots-bars-4','dots-bars-6','spinner-30',
    'progress-5','progress-19','wobbling-12','wobbling-20','wavy-12','wavy-15',
    'squishy-1','squishy-9','rolling-8','pulsing-10','pulsing-8','arcade-4','arcade-5',
    'nature-4','nature-12','time-5','hungry-1','shuriken-9','shuriken-10','eyes-6','eyes-7',
    'cut-9','cut-8','arrow-8','arrow-7','blob-12','blob-14','blob-19','factory-7','factory-8'
  ]));
