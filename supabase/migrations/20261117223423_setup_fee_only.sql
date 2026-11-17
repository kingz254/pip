-- Pipforge charges the site setup once; clients buy and renew domains with their registrar.
update public.pricing set usd = 0 where key = 'connection';
