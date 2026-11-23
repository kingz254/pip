create policy site_visits_owner_read on public.site_visits
  for select to authenticated
  using (exists (
    select 1 from public.sites s
    where s.id = site_visits.site_id and s.owner = (select auth.uid())
  ));
