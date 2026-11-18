-- Signal Desk schema. Paste into Supabase SQL editor and run once.

create table if not exists watchlist (
  ticker      text primary key,
  name        text,
  added_at    timestamptz not null default now()
);

create table if not exists prices (
  ticker  text not null references watchlist(ticker) on delete cascade,
  date    date not null,
  open    double precision not null,
  high    double precision not null,
  low     double precision not null,
  close   double precision not null,
  volume  double precision not null,
  primary key (ticker, date)
);

create table if not exists signals (
  ticker      text not null references watchlist(ticker) on delete cascade,
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

create index if not exists signals_date_idx on signals (date desc);

-- Server uses the service-role key, so lock the tables down for anon access.
alter table watchlist enable row level security;
alter table prices    enable row level security;
alter table signals   enable row level security;

-- Starter watchlist (US + a couple of London listings via Yahoo's .L suffix)
insert into watchlist (ticker, name) values
  ('AAPL', 'Apple'),
  ('MSFT', 'Microsoft'),
  ('NVDA', 'NVIDIA'),
  ('TSLA', 'Tesla'),
  ('TTWO', 'Take-Two Interactive'),
  ('VOD.L', 'Vodafone'),
  ('RR.L', 'Rolls-Royce')
on conflict do nothing;
