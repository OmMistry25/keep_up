-- ─── Enable RLS ──────────────────────────────────────────────────
alter table profiles            enable row level security;
alter table gmail_connections   enable row level security;
alter table messages            enable row level security;
alter table classifications     enable row level security;
alter table notification_prefs  enable row level security;
alter table ingestion_events    enable row level security;

-- ─── profiles ────────────────────────────────────────────────────
create policy "users can manage own profile"
  on profiles for all
  using (id = auth.uid());

-- ─── gmail_connections ───────────────────────────────────────────
create policy "users can manage own gmail connections"
  on gmail_connections for all
  using (user_id = auth.uid());

-- ─── messages ────────────────────────────────────────────────────
create policy "users can manage own messages"
  on messages for all
  using (user_id = auth.uid());

-- ─── classifications ─────────────────────────────────────────────
create policy "users can manage own classifications"
  on classifications for all
  using (user_id = auth.uid());

-- ─── notification_prefs ──────────────────────────────────────────
create policy "users can manage own notification prefs"
  on notification_prefs for all
  using (user_id = auth.uid());

-- ─── ingestion_events ────────────────────────────────────────────
-- Users can read their own events; ingestion service writes via service role (bypasses RLS)
create policy "users can read own ingestion events"
  on ingestion_events for select
  using (user_id = auth.uid());
