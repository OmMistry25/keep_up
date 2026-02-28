# Gmail Job Acceptance/Rejection Monitor
A light platform that monitors a user's Gmail inbox in near real time, classifies incoming job emails as **acceptance**, **rejection**, or **other**, and presents them in a Next.js dashboard. Uses **Supabase** for auth, database, and realtime, plus a backend ingestion pipeline that receives Gmail push notifications and fetches the new messages.

## High-level architecture
### Core components
1. **Next.js web app (frontend + server routes)**
   - Auth UI (Supabase Auth)
   - Inbox dashboard (lists classified emails, filters, search)
   - Settings (connect Gmail, choose notification preferences)
   - Server routes for OAuth callbacks and lightweight API needs

2. **Supabase**
   - Auth (email magic link or OAuth providers for your app login)
   - Postgres database (users, gmail connections, messages, classifications, audit)
   - Realtime (subscriptions for new classifications)
   - Edge Functions (optional) for webhook endpoints or cron tasks

3. **Gmail integration service**
   - Handles Gmail OAuth and token refresh
   - Sets up Gmail watch (push notifications)
   - Receives Pub/Sub notifications and pulls new messages from Gmail
   - Runs classification (rules + optional OpenAI/Gemini)
   - Writes results into Supabase

4. **Google Cloud Pub/Sub**
   - Gmail push notifications (Gmail watch targets a Pub/Sub topic)
   - Triggers ingestion via a webhook endpoint (Cloud Run or Supabase Edge Function) or a pull worker

### Data flow (real time)
1. User connects Gmail in the web app (Google OAuth consent).
2. Backend stores refresh token in Supabase (encrypted at rest).
3. Backend creates a Gmail watch for the user's mailbox pointing to a Pub/Sub topic.
4. Gmail sends change notifications to Pub/Sub.
5. Ingestion service receives notification, fetches history since last checkpoint, pulls new messages, classifies them, and inserts records into Supabase.
6. Frontend subscribes to Supabase realtime changes and updates instantly.

## Tech choices and rationale
- **Next.js App Router**: Fast iteration, server actions, route handlers for OAuth callbacks.
- **Supabase**: One system for auth, database, and realtime. Minimizes glue code.
- **Cloud Run worker (recommended)**: Stable inbound HTTP endpoint for Pub/Sub push and background work.
- **Optional LLM classifier**: Use OpenAI or Gemini only when rules are uncertain to reduce cost and latency.

---

## Repository structure
Monorepo with two deployables: the Next.js app and an ingestion service.

```
job-inbox-monitor/
  apps/
    web/
      app/
        (auth)/
          login/
            page.tsx
          callback/
            route.ts
        dashboard/
          page.tsx
          components/
            MessageTable.tsx
            MessageDetailDrawer.tsx
            StatusPills.tsx
        settings/
          page.tsx
          components/
            GmailConnectButton.tsx
            NotificationPrefsForm.tsx
        api/
          health/
            route.ts
          gmail/
            connect/
              route.ts
            disconnect/
              route.ts
            resync/
              route.ts
      components/
        ui/
        layout/
        forms/
      lib/
        supabase/
          client.ts
          server.ts
          middleware.ts
        auth/
          requireUser.ts
        config/
          env.ts
        utils/
          dates.ts
          errors.ts
      middleware.ts
      public/
      styles/
      next.config.js
      package.json
      tsconfig.json

    ingestion/
      src/
        index.ts
        config/
          env.ts
        http/
          server.ts
          routes/
            pubsubPush.ts
            health.ts
        gmail/
          oauth.ts
          watch.ts
          history.ts
          messages.ts
          parse.ts
        classify/
          rules.ts
          llm.ts
          classifier.ts
        storage/
          supabase.ts
          crypto.ts
        jobs/
          resync.ts
          refreshWatch.ts
        types/
          pubsub.ts
          gmail.ts
      Dockerfile
      package.json
      tsconfig.json

  packages/
    shared/
      src/
        types/
          db.ts
          message.ts
        constants/
          classification.ts
        utils/
          sanitize.ts
          retry.ts
      package.json
      tsconfig.json

  supabase/
    migrations/
      0001_init.sql
      0002_rls.sql
      0003_indexes.sql
    seed.sql

  scripts/
    local-dev.sh
    create-topic.sh
    setup-gmail-watch.sh

  .env.example
  README.md
```

---

## What each part does

### `apps/web` (Next.js)
- **`app/(auth)/login/page.tsx`**
  - Login UI using Supabase Auth
- **`app/(auth)/callback/route.ts`**
  - Supabase auth callback handler for your app login
- **`app/dashboard/page.tsx`**
  - Main UI showing classified messages with filters
- **`app/settings/page.tsx`**
  - Gmail connection status, notification preferences, manual resync
- **`app/api/gmail/connect/route.ts`**
  - Starts Google OAuth flow for Gmail access (redirect to Google)
- **`app/api/gmail/disconnect/route.ts`**
  - Revokes connection, deletes tokens, disables watch
- **`app/api/gmail/resync/route.ts`**
  - Triggers a backfill sync job (calls ingestion service)
- **`lib/supabase/*`**
  - Supabase client creation for browser and server
- **`middleware.ts`**
  - Protects authenticated routes and injects session

### `apps/ingestion` (Gmail ingestion and classification)
- **`http/routes/pubsubPush.ts`**
  - Receives Pub/Sub push messages from Google (HTTP POST)
  - Validates signature or token header
  - Enqueues processing (in process for MVP, queue later if needed)
- **`gmail/oauth.ts`**
  - Refreshes access tokens using stored refresh tokens
- **`gmail/watch.ts`**
  - Creates, renews, and stops Gmail watch
- **`gmail/history.ts`**
  - Uses Gmail History API to fetch changes since last historyId
- **`gmail/messages.ts`**
  - Pulls full message payloads and headers
- **`gmail/parse.ts`**
  - Extracts subject, from, snippet, received timestamp, and links
- **`classify/rules.ts`**
  - Deterministic keyword and sender heuristics
- **`classify/llm.ts`**
  - Optional LLM call for borderline cases
- **`classify/classifier.ts`**
  - Orchestrates rules then LLM fallback
- **`storage/supabase.ts`**
  - Writes messages and classifications to Supabase via service role key
- **`storage/crypto.ts`**
  - Encrypts refresh tokens before storage
- **`jobs/resync.ts`**
  - Backfill job for pulling recent threads if watch was offline

### `packages/shared`
- Shared types and utilities used by both web and ingestion services.

### `supabase/migrations`
- SQL migrations: tables, indexes, RLS policies, functions.

---

## Database schema (Supabase Postgres)
### Tables
1. **`profiles`**
   - `id uuid` (PK, equals auth.users.id)
   - `created_at timestamptz`
   - `full_name text`
   - `timezone text`

2. **`gmail_connections`**
   - `id uuid` (PK)
   - `user_id uuid` (FK -> profiles.id)
   - `google_subject text` (Google user id)
   - `email_address text`
   - `refresh_token_enc text` (encrypted)
   - `scopes text[]`
   - `watch_expiration timestamptz`
   - `last_history_id text`
   - `status text` (connected, error, disconnected)
   - `created_at timestamptz`
   - `updated_at timestamptz`

3. **`messages`**
   - `id uuid` (PK)
   - `user_id uuid` (FK)
   - `gmail_message_id text` (unique per user)
   - `thread_id text`
   - `from_email text`
   - `from_name text`
   - `subject text`
   - `snippet text`
   - `received_at timestamptz`
   - `raw_headers jsonb`
   - `raw_body_preview text` (optional, keep minimal)
   - `created_at timestamptz`
   - Indexes: `(user_id, received_at desc)`, unique `(user_id, gmail_message_id)`

4. **`classifications`**
   - `id uuid` (PK)
   - `message_id uuid` (FK -> messages.id)
   - `user_id uuid` (FK)
   - `label text` (acceptance, rejection, other, unsure)
   - `confidence numeric`
   - `method text` (rules, llm)
   - `reason text` (short rationale)
   - `links jsonb` (extracted relevant URLs, if any)
   - `created_at timestamptz`
   - Indexes: `(user_id, created_at desc)`, `(user_id, label, created_at desc)`

5. **`notification_prefs`**
   - `user_id uuid` (PK)
   - `weekly_summary_enabled boolean`
   - `weekly_summary_day int` (0-6)
   - `weekly_summary_time time`
   - `delivery_channel text` (imessage, email, sms later)
   - `created_at timestamptz`
   - `updated_at timestamptz`

6. **`ingestion_events`** (audit and debugging)
   - `id uuid` (PK)
   - `user_id uuid`
   - `event_type text` (pubsub, resync, watch_renew)
   - `payload jsonb`
   - `status text` (ok, error)
   - `error text`
   - `created_at timestamptz`

### Row Level Security (RLS)
- Enabled on all user tables.
- Policies:
  - Users can `select/insert/update/delete` rows where `user_id = auth.uid()`.
  - Ingestion service uses Supabase **service role** key to bypass RLS for writes.

---

## Auth and permissions
### App auth (Supabase)
- Users authenticate to your app using Supabase Auth.
- Frontend reads and writes user-scoped data through the Supabase client with RLS enforced.

### Gmail auth (Google OAuth)
- Separate from Supabase Auth.
- Use Google OAuth to request Gmail scopes.
- Store:
  - `refresh_token` (encrypted)
  - `email_address` and Google subject
- Access tokens are short-lived and derived on demand by ingestion service.

Recommended Gmail scopes for MVP:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify` is optional, only if you want to apply labels in Gmail.

---

## Services and connections

### 1) Web app to Supabase
- Browser uses `@supabase/supabase-js` with anon key for reads.
- Protected pages use server components or middleware to require session.

### 2) Web app to ingestion service
- Web app calls ingestion service for:
  - Trigger resync
  - Force watch renewal
- Use a signed JWT or a shared internal token in headers.

### 3) Ingestion service to Gmail API
- Uses stored refresh token to refresh access token.
- Uses Gmail History API and Messages API:
  - Fetch incremental changes since `last_history_id`.
  - Pull message metadata and snippet.

### 4) Gmail to Pub/Sub to ingestion service
- Gmail watch publishes to a Pub/Sub topic.
- Pub/Sub pushes to ingestion service webhook endpoint.
- Ingestion service processes and writes to Supabase.
- Frontend updates via Supabase realtime.

---

## State management

### Frontend state
- **Auth state**: Supabase session stored in cookies (server) and local storage (client), managed by Supabase helpers.
- **UI state**: Local component state for filters, selected message, and search.
- **Server state**: Messages and classifications fetched via Supabase queries; subscribe to realtime updates for new classifications.

### Backend state
- **Connection state**: `gmail_connections.status`, `watch_expiration`, `last_history_id`.
- **Idempotency**: `messages` unique constraint on `(user_id, gmail_message_id)` prevents duplicates.
- **Processing checkpoints**: `last_history_id` updates only after successful pull and write.

---

## Classification strategy
### Rules first
- Maintain a small keyword list and pattern rules:
  - rejection: "unfortunately", "not moving forward", "we went with another candidate"
  - acceptance: "offer", "congratulations", "we are excited", "offer letter", "welcome to"
- Sender heuristics:
  - common ATS senders: greenhouse, lever, workday, ashby, smartrecruiters
- If rules yield high confidence, store result.

### LLM fallback (optional)
- If rules are low confidence, call OpenAI or Gemini with:
  - subject, from, snippet, and a small body preview
- Output JSON:
  - `label`, `confidence`, `reason`, `links`
- Store `method = llm`.

Privacy note:
- Minimize what you send to LLMs, and make it user opt-in.

---

## Deployment
### Web app
- Deploy `apps/web` to Vercel.
- Environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `INGESTION_BASE_URL`, `INGESTION_SHARED_SECRET`

### Ingestion service
- Deploy `apps/ingestion` to Google Cloud Run (recommended) or Supabase Edge Functions for MVP if feasible.
- Set Pub/Sub push subscription endpoint to:
  - `POST https://<cloud-run-url>/pubsub/push`
- Environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `PUBSUB_VERIFICATION_TOKEN` (or JWT validation settings)
  - `ENCRYPTION_KEY` (for token encryption)
  - `LLM_PROVIDER`, `OPENAI_API_KEY` or `GEMINI_API_KEY` (optional)

---

## Security considerations
- Encrypt Google refresh tokens before storing in DB (`refresh_token_enc`).
- Store encryption key only in ingestion service environment.
- Verify Pub/Sub push requests (OIDC token or shared verification token).
- Apply strict RLS policies for all user data.
- Avoid storing full email bodies; store minimal snippet and extracted links.

---

## MVP endpoints and contracts

### Web app route handlers
- `GET /api/gmail/connect`
  - Redirects to Google OAuth consent
- `GET /api/gmail/callback`
  - Exchanges code for tokens, stores connection, calls ingestion service to set watch
- `POST /api/gmail/disconnect`
  - Calls ingestion service to stop watch, clears tokens
- `POST /api/gmail/resync`
  - Calls ingestion service to backfill last N days

### Ingestion service routes
- `POST /pubsub/push`
  - Input: Pub/Sub message with mailbox notification
  - Output: 204 quickly, process async if possible
- `GET /health`
  - Basic health check
- `POST /jobs/resync`
  - Triggers a backfill for a user
- `POST /jobs/watch/refresh`
  - Renews watch before expiration

---

## Local development workflow
1. Run Supabase locally: `supabase start`
2. Run ingestion service locally:
   - Use ngrok or Cloudflare tunnel for Pub/Sub push testing.
3. Run Next.js dev server.
4. Use scripts to create Pub/Sub topic and subscription in GCP.
5. Connect Gmail via the settings page.

---

## `.env.example`
Include keys for both deployables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`
- `PUBSUB_VERIFICATION_TOKEN`
- `ENCRYPTION_KEY`
- `LLM_PROVIDER`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
