# MVP Build Plan (Granular Tasks)

This plan assumes the architecture in `architecture.md`:

- Next.js app in `apps/web`
- Ingestion service in `apps/ingestion`
- Supabase for DB + auth + realtime
- Gmail push notifications via Pub/Sub to ingestion webhook

Conventions:

- Each task is **small and testable**.
- Each task has a **Definition of Done (DoD)** and a **Test**.
- Prefer **one concern** per task.
- Stop when tests pass before moving on.

---

## 0) Repo + tooling bootstrap

### 0.1 Create monorepo skeleton

**Start:** empty folder  
**End:** folders exist with package.json stubs  
**Steps:**

- Create `apps/web`, `apps/ingestion`, `packages/shared`, `supabase/migrations`, `scripts`
- Add root `package.json` with workspaces
- Add root `tsconfig.base.json`
**DoD:** `pnpm -r -w install` succeeds  
**Test:** `pnpm -r -w -v` prints versions, workspace recognized

### 0.2 Add shared package scaffolding

**Start:** `packages/shared` empty  
**End:** shared builds with TypeScript  
**Steps:**

- Create `packages/shared/package.json`, `tsconfig.json`, `src/index.ts`
- Export placeholder types
**DoD:** `pnpm -C packages/shared build` succeeds  
**Test:** `node -e "require('./packages/shared/dist')"` runs without error

---

## 1) Supabase project + schema

### 1.1 Initialize Supabase locally (or link remote)

**Start:** no Supabase config  
**End:** Supabase project running/linked  
**Steps:**

- `supabase init`
- (Local) `supabase start`
- Create `.env.example` and `.env.local` placeholders
**DoD:** Supabase studio reachable or remote project linked  
**Test:** `supabase status` shows services running

### 1.2 Create initial migration: core tables

**Start:** no tables  
**End:** tables exist: `profiles`, `gmail_connections`, `messages`, `classifications`, `notification_prefs`, `ingestion_events`  
**Steps:**

- Create `supabase/migrations/0001_init.sql`
- Add `uuid` PKs and FK relations
- Add unique constraint on `(user_id, gmail_message_id)` in `messages`
**DoD:** migration applies cleanly  
**Test:** `supabase db reset` completes; query tables exist

### 1.3 Add indexes migration

**Start:** tables exist, no indexes beyond PK/unique  
**End:** indexes added for common queries  
**Steps:**

- Create `supabase/migrations/0003_indexes.sql`
- Add indexes:
  - `messages (user_id, received_at desc)`
  - `classifications (user_id, created_at desc)`
  - `classifications (user_id, label, created_at desc)`
  **DoD:** migration applies cleanly  
  **Test:** `EXPLAIN` on dashboard query uses indexes

### 1.4 Enable RLS and create policies

**Start:** RLS off  
**End:** RLS on with correct policies  
**Steps:**

- Create `supabase/migrations/0002_rls.sql`
- Enable RLS on user tables
- Policies: allow users access when `user_id = auth.uid()`
**DoD:** anon cannot read others’ rows  
**Test:** using Supabase SQL editor:
- Insert row for user A; ensure user B cannot select it

### 1.5 Add seed script (optional minimal)

**Start:** no seed  
**End:** seed inserts one sample message/classification for a test user (optional)  
**Steps:** create `supabase/seed.sql` with minimal inserts  
**DoD:** seed runs without error  
**Test:** dashboard query returns seed data (if you set auth context)

---

## 2) Next.js web app (auth + basic UI)

### 2.1 Create Next.js app with App Router

**Start:** no `apps/web` app  
**End:** Next.js app runs  
**Steps:**

- Scaffold Next.js with TypeScript
- Add `.env.local` with Supabase URL + anon key
**DoD:** `pnpm -C apps/web dev` starts  
**Test:** visit `/` and see placeholder page

### 2.2 Add Supabase client helpers (browser + server)

**Start:** no Supabase helpers  
**End:** `lib/supabase/client.ts` and `lib/supabase/server.ts` exist  
**Steps:**

- Add supabase-js client initialization
- Add server helper using cookies (or @supabase/auth-helpers-nextjs if desired)
**DoD:** code compiles, no runtime errors  
**Test:** simple server component queries `select 1` or fetches session

### 2.3 Implement login page

**Start:** no auth UI  
**End:** `/login` supports email magic link (or password)  
**Steps:**

- Create `app/(auth)/login/page.tsx`
- Call Supabase auth sign-in
**DoD:** user can request magic link and authenticate  
**Test:** log in and confirm session exists in browser

### 2.4 Add route protection middleware

**Start:** dashboard accessible without auth  
**End:** unauth user redirected to `/login`  
**Steps:**

- Add `middleware.ts` and `lib/supabase/middleware.ts`
- Protect `/dashboard` and `/settings`
**DoD:** protected routes require auth  
**Test:** open `/dashboard` in incognito -> redirected

### 2.5 Create dashboard skeleton page

**Start:** no dashboard  
**End:** `/dashboard` renders authenticated layout  
**Steps:**

- Create `app/dashboard/page.tsx`
- Add empty table component
**DoD:** page loads and shows “No messages yet” state  
**Test:** authenticated user sees page

### 2.6 Implement messages list query

**Start:** dashboard static  
**End:** dashboard fetches `messages` + latest `classifications`  
**Steps:**

- Add query from Supabase:
  - messages by user ordered by received_at desc
  - join latest classification (or fetch via view later)
  **DoD:** dashboard shows rows if data exists  
  **Test:** manually insert a row in DB for user; refresh shows it

### 2.7 Add realtime subscription for new classifications

**Start:** dashboard requires refresh  
**End:** dashboard updates on insert to `classifications`  
**Steps:**

- Subscribe to `classifications` for `user_id`
- On event, re-fetch or append row
**DoD:** new classification appears without reload  
**Test:** insert a classification row; UI updates within seconds

### 2.8 Create settings page skeleton

**Start:** no settings  
**End:** `/settings` shows “Gmail status” placeholder  
**Steps:**

- Create `app/settings/page.tsx`
- Show connection status from `gmail_connections`
**DoD:** settings loads and shows connected/disconnected state  
**Test:** insert a gmail_connections row and see correct status

---

## 3) Google OAuth for Gmail (web app route handlers)

### 3.1 Create Google OAuth config + env validation

**Start:** env scattered  
**End:** central env loader with validation  
**Steps:**

- Add `apps/web/lib/config/env.ts`
- Validate required vars:
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  - SUPABASE service role key (server-only)
  **DoD:** app fails fast with clear error if env missing  
  **Test:** remove var and confirm error is explicit

### 3.2 Implement `/api/gmail/connect` route

**Start:** no connect endpoint  
**End:** endpoint redirects to Google consent screen  
**Steps:**

- Create `app/api/gmail/connect/route.ts`
- Build OAuth URL with:
  - redirect_uri to `/api/gmail/callback`
  - scope `gmail.readonly`
  - access_type=offline, prompt=consent (to ensure refresh token)
  - state includes user_id (signed)
  **DoD:** clicking “Connect Gmail” redirects to Google  
  **Test:** verify URL contains scopes and redirect_uri

### 3.3 Implement `/api/gmail/callback` route: exchange code

**Start:** callback does nothing  
**End:** callback exchanges code for tokens and stores refresh token encrypted (via ingestion or direct)  
**Steps:**

- Create `app/api/gmail/callback/route.ts`
- Validate `state` signature and map to app user_id
- Exchange `code` at Google token endpoint
- Persist:
  - email address (call `gmail.users.getProfile`)
  - refresh token (encrypted)
  - scopes, status=connected
  **DoD:** after consent, user returns to `/settings` with connected state  
  **Test:** verify DB row created in `gmail_connections`

### 3.4 Add disconnect endpoint

**Start:** cannot disconnect  
**End:** `/api/gmail/disconnect` clears stored tokens and marks disconnected  
**Steps:**

- Create `app/api/gmail/disconnect/route.ts`
- Delete/blank `refresh_token_enc` and set `status=disconnected`
**DoD:** settings shows disconnected after action  
**Test:** click disconnect and verify DB update

---

## 4) Ingestion service bootstrap

### 4.1 Scaffold ingestion Node service

**Start:** no service  
**End:** TypeScript Node server runs with health route  
**Steps:**

- Create `apps/ingestion/package.json`, TS config
- Add minimal HTTP server (Express/Fastify)
- Add `GET /health`
**DoD:** `pnpm -C apps/ingestion dev` runs  
**Test:** curl `/health` returns 200

### 4.2 Add Supabase admin client to ingestion

**Start:** no Supabase writes  
**End:** service can insert into `ingestion_events` using service role key  
**Steps:**

- Implement `storage/supabase.ts`
- Insert a test event
**DoD:** insertion succeeds  
**Test:** run a script or endpoint that writes one row; verify in DB

### 4.3 Add token encryption helper

**Start:** refresh tokens stored plaintext (blocked)  
**End:** encrypt/decrypt utilities exist  
**Steps:**

- Implement `storage/crypto.ts` using AES-GCM with `ENCRYPTION_KEY`
- Add tests for roundtrip
**DoD:** encryption roundtrip passes  
**Test:** unit test encrypt->decrypt equals original

---

## 5) Gmail API integration (pull-based first)

MVP recommendation: implement a manual “resync” that pulls recent messages before push notifications. This proves Gmail auth + parsing + classification + DB writes end-to-end.

### 5.1 Implement Gmail OAuth token refresh in ingestion

**Start:** cannot call Gmail APIs reliably  
**End:** can obtain access token from refresh token  
**Steps:**

- Implement `gmail/oauth.ts`:
  - read `refresh_token_enc` from DB
  - decrypt
  - call Google token endpoint to get access token
  **DoD:** access token obtained for a connected user  
  **Test:** unit test with mocked HTTP; integration test by calling Gmail profile

### 5.2 Implement Gmail profile fetch

**Start:** no Gmail API call  
**End:** call `users.getProfile` successfully  
**Steps:**

- Implement `gmail/messages.ts` or `gmail/profile.ts`
**DoD:** returns emailAddress and historyId  
**Test:** call endpoint `/debug/gmail/profile?user=...` (dev-only) and see response

### 5.3 Implement “list messages” (recent)

**Start:** cannot list inbox items  
**End:** list message IDs from `INBOX` for last N results  
**Steps:**

- Call `users.messages.list` with `maxResults`
**DoD:** returns array of message IDs  
**Test:** log count > 0 for a real inbox

### 5.4 Implement “get message metadata”

**Start:** cannot fetch subject/from/snippet  
**End:** fetch headers and snippet for a message ID  
**Steps:**

- Call `users.messages.get` with `format=metadata` and `metadataHeaders`
**DoD:** returns subject/from/date/snippet  
**Test:** parse subject and from for one known email

### 5.5 Implement message parsing module

**Start:** raw Gmail payload only  
**End:** `gmail/parse.ts` returns normalized object  
**Steps:**

- Parse From into `from_name`, `from_email`
- Parse Date into timestamp
- Extract subject and snippet
**DoD:** normalized object matches expected fields  
**Test:** unit test with recorded sample payload JSON

### 5.6 Implement DB upsert for messages

**Start:** no persistence  
**End:** insert message row idempotently  
**Steps:**

- In `storage/supabase.ts`, write `upsertMessage(user_id, gmail_message_id, ...)`
- Use unique constraint to avoid duplicates
**DoD:** running twice does not create duplicates  
**Test:** call twice and confirm only one row exists

---

## 6) Classification (rules-only first)

### 6.1 Implement rules classifier

**Start:** no classification  
**End:** classify based on subject/snippet/from  
**Steps:**

- Create `classify/rules.ts` with keyword lists
- Return `{label, confidence, reason, method:'rules'}`
**DoD:** known acceptance/rejection samples classify correctly  
**Test:** unit tests with at least 10 samples each

### 6.2 Implement classification write

**Start:** classification not stored  
**End:** insert into `classifications` referencing message_id  
**Steps:**

- After upserting message, insert classification row
**DoD:** classification row created for each processed message  
**Test:** process one message and confirm DB has linked rows

### 6.3 Add link extraction (minimal)

**Start:** no links captured  
**End:** extract URLs from snippet (and optional body preview later)  
**Steps:**

- Simple regex URL extractor
- Store in `classifications.links`
**DoD:** links array present when snippet contains URL  
**Test:** unit test with snippet containing `https://...`

---

## 7) Manual resync job (end-to-end happy path)

### 7.1 Implement ingestion endpoint `POST /jobs/resync`

**Start:** no way to pull messages on demand  
**End:** endpoint pulls last N messages and writes to DB  
**Steps:**

- Input: `{ user_id, max_results }` with auth header secret
- For each message ID:
  - fetch metadata
  - parse
  - upsert message
  - classify
  - insert classification
  **DoD:** running resync populates dashboard with classified rows  
  **Test:** call from curl; open dashboard and see new rows

### 7.2 Wire web app “Resync” button

**Start:** settings cannot trigger ingestion  
**End:** settings triggers resync and shows progress message  
**Steps:**

- `POST /api/gmail/resync` in web calls ingestion `/jobs/resync`
- UI shows success/failure
**DoD:** user can click resync and see new messages  
**Test:** click resync and confirm DB rows increase

---

## 8) Gmail push notifications (Pub/Sub)

### 8.1 Create Pub/Sub topic and push subscription (manual script)

**Start:** no Pub/Sub infra  
**End:** topic + subscription exist and push to ingestion URL  
**Steps:**

- Add `scripts/create-topic.sh`
- Create topic and push subscription with endpoint:
  - `https://<ingestion>/pubsub/push`
- Set verification token header or OIDC auth
**DoD:** subscription exists in GCP console  
**Test:** publish test message to topic, ingestion receives

### 8.2 Implement `/pubsub/push` route handler

**Start:** endpoint missing  
**End:** endpoint validates and logs receipt  
**Steps:**

- Add route `POST /pubsub/push`
- Validate token header
- Parse Pub/Sub envelope
- Write `ingestion_events` row for auditing
**DoD:** returns 204 quickly and logs event  
**Test:** publish test message; confirm ingestion_events entry

### 8.3 Implement Gmail watch creation

**Start:** no watch setup  
**End:** call Gmail `users.watch` and store expiration/historyId  
**Steps:**

- Implement `gmail/watch.ts`:
  - call `users.watch` with topicName
  - store `watch_expiration` and `last_history_id`
  **DoD:** watch created and DB updated  
  **Test:** call watch setup for user; verify expiration in DB

### 8.4 Trigger watch creation after OAuth connect

**Start:** user connects Gmail but watch not set  
**End:** connect flow sets up watch  
**Steps:**

- In callback route (web) call ingestion endpoint `/jobs/watch/refresh` (or directly call watch logic if hosted together)
**DoD:** connected user has active watch set  
**Test:** connect Gmail and verify watch_expiration set

### 8.5 Implement history-based incremental sync on Pub/Sub event

**Start:** Pub/Sub triggers but no processing  
**End:** ingestion reads Gmail History API and processes new messages only  
**Steps:**

- Parse pubsub message to determine which mailbox (use emailAddress mapping or stored google_subject)
- Read `last_history_id` from DB
- Call Gmail `users.history.list` since that historyId
- Extract added message IDs
- Fetch/parse/upsert/classify for each
- Update `last_history_id` after success
**DoD:** new inbound email appears in dashboard within minutes  
**Test:** send a test email that matches acceptance/rejection keywords; verify UI updates

### 8.6 Add idempotency guard for Pub/Sub retries

**Start:** duplicate processing possible  
**End:** safe retries  
**Steps:**

- Ensure message upsert unique constraint prevents duplicates
- Optional: store pubsub `messageId` in `ingestion_events` unique to prevent reprocessing
**DoD:** repeated push does not duplicate dashboard entries  
**Test:** resend same Pub/Sub payload and confirm no duplicates

---

## 9) UX polish (minimal)

### 9.1 Add filters for acceptance/rejection/other

**Start:** list only  
**End:** filter chips change query  
**Steps:**

- Implement filter state in dashboard
- Query `classifications.label`
**DoD:** filter displays correct subset  
**Test:** seed both labels and validate counts

### 9.2 Add message detail drawer

**Start:** cannot inspect details  
**End:** click row shows full metadata + links  
**Steps:**

- `MessageDetailDrawer` component
**DoD:** clicking a row opens drawer  
**Test:** UI interaction works, no console errors

### 9.3 Add connection status and error surface

**Start:** silent failures  
**End:** settings shows last error/event  
**Steps:**

- Query latest `ingestion_events` errors for user
- Display “Last sync” and “Last error”
**DoD:** user can diagnose connection issues  
**Test:** inject error event row and confirm UI shows it

---

## 10) Optional: LLM fallback classifier (feature flag)

### 10.1 Add `classify/llm.ts` stub with provider switch

**Start:** rules only  
**End:** LLM module callable but behind flag  
**Steps:**

- Environment variable `LLM_PROVIDER` and keys
- Define function returning JSON
**DoD:** module compiles even without API keys (not called)  
**Test:** unit test for “provider missing” branch

### 10.2 Add LLM fallback invocation for low confidence

**Start:** low-confidence rules remain “other/unsure”  
**End:** LLM resolves `unsure` when enabled  
**Steps:**

- In `classifier.ts`, if confidence < threshold and enabled, call LLM
- Store method = `llm`
**DoD:** classification method recorded as `llm` when used  
**Test:** create borderline sample and confirm `llm` path taken

---

## 11) Deployment (minimal MVP)

### 11.1 Deploy Supabase (remote project)

**Start:** local-only  
**End:** remote Supabase with migrations applied  
**Steps:**

- Create Supabase project
- Apply migrations via CLI
- Configure auth settings (redirect URLs)
**DoD:** remote DB and auth working  
**Test:** web app can login against remote

### 11.2 Deploy ingestion service to Cloud Run

**Start:** local ingestion only  
**End:** Cloud Run service with public URL  
**Steps:**

- Build container, deploy
- Set env vars and secrets
**DoD:** `/health` returns 200 publicly (or restricted)  
**Test:** curl Cloud Run URL `/health`

### 11.3 Configure Pub/Sub push subscription to Cloud Run URL

**Start:** no live pushes  
**End:** live push subscription  
**Steps:**

- Update subscription endpoint to Cloud Run `/pubsub/push`
- Enable auth/verification
**DoD:** test publish reaches Cloud Run and logs event  
**Test:** publish test message and verify ingestion_events

### 11.4 Deploy Next.js web app to Vercel

**Start:** local web only  
**End:** Vercel deployment with env vars configured  
**Steps:**

- Set env vars in Vercel
- Add Supabase redirect URLs
**DoD:** login, connect Gmail, and dashboard work in production  
**Test:** full flow on prod domain

---

## MVP acceptance checklist

- User can sign up/login (Supabase Auth)
- User can connect Gmail (Google OAuth)
- Manual resync pulls recent inbox messages and classifies them
- Gmail watch + Pub/Sub push triggers incremental processing
- Dashboard updates in near real time via Supabase realtime
- No duplicates (idempotent writes)
- Tokens encrypted at rest; RLS enforced for user data

