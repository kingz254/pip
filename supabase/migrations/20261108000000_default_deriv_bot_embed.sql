-- New sites start with the official Deriv Bot experience embedded.
alter table public.sites alter column bot_mode set default 'embed';
