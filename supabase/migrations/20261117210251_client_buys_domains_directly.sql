-- Domain registrations are paid directly by the client to their registrar.
-- Pipforge only takes payment for setup and connecting a client-owned domain.
create or replace function public.create_order(p_site uuid) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  s public.sites; o public.orders;
  setup numeric; conn numeric := 0;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into s from public.sites where id = p_site and owner = auth.uid() for update;
  if not found then raise exception 'site not found' using errcode = 'P0002'; end if;
  if s.status not in ('draft','pending_payment') then raise exception 'site is already paid for' using errcode = '22023'; end if;
  if s.domain is null then raise exception 'choose a domain first' using errcode = '22023'; end if;
  if s.domain_mode <> 'own' then
    raise exception 'buy the domain directly from your registrar, then enter it as a domain you own' using errcode = '22023';
  end if;

  select usd into setup from public.pricing where key = 'setup';
  select usd into conn from public.pricing where key = 'connection';
  update public.orders set status = 'cancelled' where site_id = s.id and status = 'pending';
  insert into public.orders (owner, site_id, domain, domain_mode, setup_usd, domain_usd, connection_usd, total_usd)
       values (s.owner, s.id, s.domain, s.domain_mode, setup, 0, conn, setup + conn)
    returning * into o;
  update public.sites set status = 'pending_payment' where id = s.id;
  return o;
exception when unique_violation then
  raise exception 'domain is already taken' using errcode = '23505';
end $$;
