-- Only the backend can read these AES-GCM encrypted, expiring OAuth records.
create table public.deriv_oauth_sessions (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  payload text not null,
  expires_at timestamptz not null
);
create index deriv_oauth_sessions_expiry on public.deriv_oauth_sessions(expires_at);
alter table public.deriv_oauth_sessions enable row level security;
revoke all on public.deriv_oauth_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.deriv_oauth_sessions to service_role;

-- New OAuth client IDs are not restricted to legacy numeric app IDs.
alter table public.sites drop constraint if exists sites_deriv_app_id_check;
alter table public.sites add constraint sites_deriv_app_id_check
  check (deriv_app_id is null or deriv_app_id ~ '^[A-Za-z0-9_-]{1,128}$');
