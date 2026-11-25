create function public.set_all_premium_bot_access(p_site uuid, p_account text, p_enabled boolean)
returns integer
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_account is null or p_account !~ '^[A-Za-z0-9_-]{3,64}$' then
    raise exception 'invalid Deriv account ID' using errcode = '22023';
  end if;
  if p_enabled is null then raise exception 'choose grant or revoke' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.sites s
    where s.id = p_site and s.owner = auth.uid() and s.status = 'live'
      and public.site_has_premium_access(s.id)
  ) then raise exception 'A live Premium site owner is required' using errcode = '42501'; end if;

  if p_enabled then
    insert into public.premium_bot_grants(site_id, bot_id, account_id, granted_by, revoked_at)
    select p_site, c.id, p_account, auth.uid(), null
    from public.premium_bot_catalog c
    on conflict (site_id, bot_id, account_id) do update
      set granted_by = auth.uid(), granted_at = now(), revoked_at = null;
    get diagnostics changed = row_count;
  else
    update public.premium_bot_grants
      set revoked_at = now()
      where site_id = p_site and account_id = p_account and revoked_at is null;
    get diagnostics changed = row_count;
  end if;
  return changed;
end $$;
revoke all on function public.set_all_premium_bot_access(uuid, text, boolean) from public, anon;
grant execute on function public.set_all_premium_bot_access(uuid, text, boolean) to authenticated;
