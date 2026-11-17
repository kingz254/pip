-- Keep checkout limited to common generic endings; customers register domains in their own name.
update public.tld_prices set enabled = false
where tld not in ('.com','.net','.org','.site','.online','.store','.app','.dev','.pro','.live','.xyz');

alter table public.payments drop constraint payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('mpesa','card','crypto_manual'));

create function public.admin_confirm_crypto_payment(p_order uuid, p_txid text) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders; p public.payments;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if trim(coalesce(p_txid, '')) !~ '^[A-Fa-f0-9]{64}$' then
    raise exception 'enter the 64-character transaction ID from TRON' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if o.status <> 'pending' then raise exception 'this order is not waiting for payment' using errcode = '22023'; end if;
  select * into p from public.payments
   where order_id = o.id and provider = 'crypto_manual' and provider_ref = lower(trim(p_txid)) and status = 'initiated'
   for update;
  if not found then raise exception 'client has not submitted this transaction ID' using errcode = '22023'; end if;
  return public.mark_order_paid(o.id, 'crypto_manual', lower(trim(p_txid)), lower(trim(p_txid)));
end $$;
revoke all on function public.admin_confirm_crypto_payment(uuid, text) from public, anon;
grant execute on function public.admin_confirm_crypto_payment(uuid, text) to authenticated;

create function public.submit_crypto_payment(p_order uuid, p_txid text) returns public.payments
language plpgsql security definer set search_path = '' as $$
declare o public.orders; p public.payments;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '28000'; end if;
  if trim(coalesce(p_txid, '')) !~ '^[A-Fa-f0-9]{64}$' then
    raise exception 'enter the 64-character transaction ID from TRON' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order and owner = auth.uid() for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if o.status <> 'pending' then raise exception 'this order is not waiting for payment' using errcode = '22023'; end if;
  insert into public.payments (order_id, provider, provider_ref, amount_minor, currency, status, receipt, raw)
  values (o.id, 'crypto_manual', lower(trim(p_txid)), round(o.total_usd * 100), 'USDT', 'initiated', lower(trim(p_txid)), '{"network":"TRC20"}'::jsonb)
  on conflict (provider, provider_ref) do nothing;
  select * into p from public.payments where provider = 'crypto_manual' and provider_ref = lower(trim(p_txid));
  if p.order_id <> o.id then raise exception 'this transaction ID was already submitted' using errcode = '23505'; end if;
  return p;
end $$;
revoke all on function public.submit_crypto_payment(uuid, text) from public, anon;
grant execute on function public.submit_crypto_payment(uuid, text) to authenticated;

create table public.site_visits (
  site_id uuid not null references public.sites(id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0 check (views >= 0),
  primary key (site_id, day)
);
alter table public.site_visits enable row level security;
create policy site_visits_admin_read on public.site_visits for select to authenticated using (public.is_admin());
grant select on public.site_visits to authenticated;

-- shortcut: public page-view counts can be inflated by repeated requests; add edge rate limiting if abuse appears.
create function public.record_public_site_visit(p_domain text) returns void
language sql security definer set search_path = '' as $$
  insert into public.site_visits as today (site_id, day, views)
  select id, current_date, 1 from public.sites
   where lower(domain) = lower(trim(p_domain)) and status = 'live'
  on conflict (site_id, day) do update set views = today.views + 1
$$;
revoke all on function public.record_public_site_visit(text) from public, authenticated;
grant execute on function public.record_public_site_visit(text) to anon, authenticated;
