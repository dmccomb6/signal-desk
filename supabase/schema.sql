-- Signal Desk schema. Paste into the Supabase SQL editor and run once.
-- Everything lives in its own `signal_desk` schema so it can share a project
-- with other apps (whose tables stay in `public`) without clashing.
--
-- After running this: Dashboard -> Integrations -> Data API -> Settings ->
-- add `signal_desk` to "Exposed schemas" and save.

create schema if not exists signal_desk;

create table if not exists signal_desk.watchlist (
  ticker      text primary key,
  name        text,
  added_at    timestamptz not null default now()
);

create table if not exists signal_desk.prices (
  ticker  text not null references signal_desk.watchlist(ticker) on delete cascade,
  date    date not null,
  open    double precision not null,
  high    double precision not null,
  low     double precision not null,
  close   double precision not null,
  volume  double precision not null,
  primary key (ticker, date)
);

create table if not exists signal_desk.signals (
  ticker      text not null references signal_desk.watchlist(ticker) on delete cascade,
  date        date not null,
  close       double precision not null,
  score       integer not null,
  action      text not null check (action in ('BUY', 'SELL', 'HOLD')),
  confidence  double precision not null,
  reasons     jsonb not null default '[]'::jsonb,
  outliers    jsonb not null default '[]'::jsonb,
  changed     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (ticker, date)
);

create index if not exists signals_date_idx on signal_desk.signals (date desc);

-- RLS on with no policies = anon/authenticated keys can't read or write anything.
alter table signal_desk.watchlist enable row level security;
alter table signal_desk.prices    enable row level security;
alter table signal_desk.signals   enable row level security;

-- Only the server (service_role key) talks to this schema.
grant usage on schema signal_desk to service_role;
grant select, insert, update, delete on all tables in schema signal_desk to service_role;
alter default privileges for role postgres in schema signal_desk
  grant select, insert, update, delete on tables to service_role;

-- Starter watchlist
insert into signal_desk.watchlist (ticker, name) values
  ('SNPS', 'Synopsys'),
  ('V',    'Visa'),
  ('BKKT', 'Bakkt'),
  ('NVDA', 'NVIDIA')
on conflict do nothing;
