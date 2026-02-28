-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  full_name   text,
  timezone    text
);

-- ─── gmail_connections ───────────────────────────────────────────
create table gmail_connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  google_subject      text not null,
  email_address       text not null,
  refresh_token_enc   text,
  scopes              text[],
  watch_expiration    timestamptz,
  last_history_id     text,
  status              text not null default 'disconnected',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── messages ────────────────────────────────────────────────────
create table messages (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  gmail_message_id  text not null,
  thread_id         text,
  from_email        text,
  from_name         text,
  subject           text,
  snippet           text,
  received_at       timestamptz,
  raw_headers       jsonb,
  raw_body_preview  text,
  created_at        timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

-- ─── classifications ─────────────────────────────────────────────
create table classifications (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references messages(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  label       text not null,
  confidence  numeric,
  method      text,
  reason      text,
  links       jsonb,
  created_at  timestamptz not null default now()
);

-- ─── notification_prefs ──────────────────────────────────────────
create table notification_prefs (
  user_id                  uuid primary key references profiles(id) on delete cascade,
  weekly_summary_enabled   boolean not null default false,
  weekly_summary_day       int,
  weekly_summary_time      time,
  delivery_channel         text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ─── ingestion_events ────────────────────────────────────────────
create table ingestion_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  event_type  text not null,
  payload     jsonb,
  status      text not null default 'ok',
  error       text,
  created_at  timestamptz not null default now()
);
