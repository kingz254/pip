create table public.premium_copy_leaders (
  site_id uuid primary key references public.sites(id) on delete cascade,
  account_id text not null check (account_id ~ '^[A-Za-z0-9_-]{3,64}$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.premium_copy_followers (
  site_id uuid not null references public.sites(id) on delete cascade,
  account_id text not null check (account_id ~ '^[A-Za-z0-9_-]{3,64}$'),
  enabled boolean not null default false,
  stake_cap numeric(12,2) not null check (stake_cap > 0 and stake_cap <= 1000),
  daily_loss_cap numeric(12,2) not null check (daily_loss_cap > 0 and daily_loss_cap <= 10000),
  consented_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(site_id, account_id)
);

create table public.premium_copy_signals (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  leader_account_id text not null check (leader_account_id ~ '^[A-Za-z0-9_-]{3,64}$'),
  source_contract_id bigint not null,
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 seconds'),
  unique(site_id, source_contract_id)
);
create index premium_copy_signals_site_recent on public.premium_copy_signals(site_id, created_at desc);

create table public.premium_copy_deliveries (
  signal_id bigint not null references public.premium_copy_signals(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  account_id text not null check (account_id ~ '^[A-Za-z0-9_-]{3,64}$'),
  claimed_at timestamptz not null default now(),
  primary key(signal_id, account_id)
);

alter table public.premium_copy_leaders enable row level security;
alter table public.premium_copy_followers enable row level security;
alter table public.premium_copy_signals enable row level security;
alter table public.premium_copy_deliveries enable row level security;
revoke all on public.premium_copy_leaders, public.premium_copy_followers,
  public.premium_copy_signals, public.premium_copy_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.premium_copy_leaders, public.premium_copy_followers to service_role;
grant select, insert, update, delete on public.premium_copy_signals to service_role;
grant select, insert on public.premium_copy_deliveries to service_role;
grant usage, select on sequence public.premium_copy_signals_id_seq to service_role;
