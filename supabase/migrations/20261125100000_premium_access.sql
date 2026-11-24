-- Only trusted checkout snapshots the package. Existing purchases stay Regular.
create function public.create_package_order(p_site uuid,p_package text default 'regular') returns public.orders
language plpgsql security definer set search_path='' as $$
declare o public.orders; amount numeric;
begin
 if auth.uid() is null then raise exception 'not signed in' using errcode='28000'; end if;
 if p_package is null or p_package not in ('regular','premium') then raise exception 'invalid package' using errcode='22023'; end if;
 if p_package='premium' and not coalesce((public.package_prices()->>'premium_available')::boolean,false) then
  raise exception 'Premium checkout opens after private execution is ready' using errcode='22023';
 end if;
 o:=public.create_order(p_site);
 if p_package='premium' then
  amount:=(public.package_prices()->>'premium')::numeric;
  update public.orders set package='premium',setup_usd=amount,total_usd=amount+domain_usd+connection_usd where id=o.id returning * into o;
 end if;
 return o;
end $$;
revoke all on function public.create_package_order(uuid,text) from public,anon;
grant execute on function public.create_package_order(uuid,text) to authenticated;

create table public.premium_bot_catalog (
 id text primary key check(id ~ '^premium-[0-9]{2}$'),
 name text not null,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 execution_ready boolean not null default false
);
alter table public.premium_bot_catalog enable row level security;
grant select on public.premium_bot_catalog to anon,authenticated;
create policy premium_catalog_read on public.premium_bot_catalog for select to anon,authenticated using(true);

create table public.premium_bot_grants (
 site_id uuid not null references public.sites(id) on delete cascade,
 bot_id text not null references public.premium_bot_catalog(id),
 account_id text not null check(account_id ~ '^[A-Za-z0-9_-]{3,64}$'),
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(site_id,bot_id,account_id)
);
alter table public.premium_bot_grants enable row level security;
grant select on public.premium_bot_grants to authenticated;
create policy premium_grants_owner_read on public.premium_bot_grants for select to authenticated using(exists(select 1 from public.sites s where s.id=site_id and s.owner=(select auth.uid())));

create function public.set_premium_bot_access(p_site uuid,p_bot text,p_account text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not signed in' using errcode='28000'; end if;
 if not exists(select 1 from public.sites s join public.orders o on o.site_id=s.id where s.id=p_site and s.owner=auth.uid() and s.status='live' and o.status='paid' and o.package='premium') then
  raise exception 'A paid Premium site owner is required' using errcode='42501';
 end if;
 if p_enabled is null then raise exception 'choose grant or revoke' using errcode='22023'; end if;
 insert into public.premium_bot_grants(site_id,bot_id,account_id,granted_by,revoked_at)
 values(p_site,p_bot,p_account,auth.uid(),case when p_enabled then null else now() end)
 on conflict(site_id,bot_id,account_id) do update set granted_by=auth.uid(),granted_at=now(),revoked_at=case when p_enabled then null else now() end;
end $$;
revoke all on function public.set_premium_bot_access(uuid,text,text,boolean) from public,anon;
grant execute on function public.set_premium_bot_access(uuid,text,text,boolean) to authenticated;

insert into public.premium_bot_catalog(id,name,source_sha256) values
('premium-01','Range Pilot','d19cc0046916792d5b009c508d5f3df762799ebe1b6acb2c91c83d3e4f55e0ad'),
('premium-02','Stake Ladder','1c8f48f64d680522ffab654f9dc78847ab1217b0f9271ffcb09cb4928c9a3db4'),
('premium-03','Digit Compass','13c1dc71858c67bcbc28bf06612df01b7f7ea514450a2438e20b48fc55ffa6cf'),
('premium-04','Volatility Scout','e7ddeb19d81fc0b8eb7138f71d33ab5ddf8adb079346321e264e1777738d2243'),
('premium-05','Over Tracker','ce3c3304e6245479dc4b0d59bfb81a30a9d5660235392edf997d5c461593e338'),
('premium-06','Match Matrix','d954139c55e544e64c0cb562bef0c68317904730917199a90595b26c0be0299c'),
('premium-07','Prediction Grid','c2688c2b3349a18a3f3e43104e3821bb2f1e1c2ca80c1e726908b2e1f87eefff'),
('premium-08','Twin Over','d8ab3885a8e95adc1f14462ce34b489a42b611e9e6594b08d0bd4369981f432e'),
('premium-09','Split Recovery','033dee5f933c219178214f1e31ff3aded0856869cd0b0e89d7fcc016d9ddf0a2'),
('premium-10','Master Sequence','4b3ef0bd6e25100f26a6fd2f38fa9212f75a2beef74e1282ab7fa7f15d2a3d1a'),
('premium-11','Differ Guard','389da5c9695c0aae1191f28a48202f3d68c0d8c6cea2ed1c7da96b4ae6e6a50a'),
('premium-12','Profit Cycle','ec5b0478434524b81aff7b16c87c9d3755e8964f1a51e1860a8964adb41b8c69'),
('premium-13','Recovery Eight','318e274dec49dd0471f1748d8613e62b2d5f8e078f8e067b227b1f19f5f82ec3'),
('premium-14','Rise Navigator','404fd84a4afd7b1acd0572f1381b676181d5c37e5e85fef2798d3038a043645a'),
('premium-15','Speed Sequence','2e73099215fe6ca008ac4071c56b3c2d69482872f92e576941840ef476ef232e'),
('premium-16','Tesla Trend','ca2f789ef11c21c88c5102ee7f4033663a1f6e5fd30e59081c1309e4f2f8675e'),
('premium-17','Consecutive Digits','c06f4e293fe4915176a580427c0c95b784ea152a91b3bd71bc1de611e981f406'),
('premium-18','Touch Trigger','86b291eaf033347ec930383e508c1e31b876c10824fd03d16e8c263a923eeaea'),
('premium-19','Under Nine','94f5cdb3af9e7412139829f2a118a648d3c6eda89b567e3180d5d1f148535ff5'),
('premium-20','Differ Engine','5de0d4d13d6811ee4daacc855153dc178fdcbc0ccd11bf10f252ed8bbd90d968');
