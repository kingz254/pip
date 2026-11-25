create or replace function public.site_premium_copy_leader(p_site uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.sites s
    where s.id = p_site and s.owner = auth.uid() and s.status = 'live'
      and public.site_has_premium_access(s.id)
  ) then
    raise exception 'A live Premium site owner is required' using errcode = '42501';
  end if;
  return (select l.account_id from public.premium_copy_leaders l
    where l.site_id = p_site and l.enabled order by l.updated_at desc limit 1);
end
$$;

create or replace function public.set_site_premium_copy_leader(
  p_site uuid,
  p_account text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_account is null or p_account !~ '^[A-Za-z0-9_-]{3,64}$' then
    raise exception 'invalid Deriv account ID' using errcode = '22023';
  end if;
  if p_enabled is null then
    raise exception 'choose enable or stop' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.sites s
    where s.id = p_site and s.owner = auth.uid() and s.status = 'live'
      and public.site_has_premium_access(s.id)
  ) then
    raise exception 'A live Premium site owner is required' using errcode = '42501';
  end if;

  delete from public.premium_copy_signals where site_id = p_site;
  if p_enabled then
    insert into public.premium_copy_leaders(site_id, account_id, enabled, updated_at)
    values (p_site, p_account, true, now())
    on conflict (site_id) do update
      set account_id = excluded.account_id, enabled = true, updated_at = now();
  else
    delete from public.premium_copy_leaders where site_id = p_site;
  end if;
end
$$;

revoke all on function public.site_premium_copy_leader(uuid) from public, anon;
grant execute on function public.site_premium_copy_leader(uuid) to authenticated;
revoke all on function public.set_site_premium_copy_leader(uuid, text, boolean) from public, anon;
grant execute on function public.set_site_premium_copy_leader(uuid, text, boolean) to authenticated;
