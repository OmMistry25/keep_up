-- Seed: insert one sample message + classification for a test user.
-- Replace <your-auth-user-id> with a real user UUID from auth.users after signing up.

do $$
declare
  v_user_id uuid := '<your-auth-user-id>';
  v_msg_id  uuid := gen_random_uuid();
begin
  -- profile (skip if already exists)
  insert into profiles (id, full_name)
  values (v_user_id, 'Test User')
  on conflict (id) do nothing;

  -- sample message
  insert into messages (id, user_id, gmail_message_id, thread_id, from_email, from_name, subject, snippet, received_at)
  values (
    v_msg_id,
    v_user_id,
    'seed_msg_001',
    'seed_thread_001',
    'recruiter@company.com',
    'Jane Recruiter',
    'We are excited to offer you the position',
    'Congratulations! We would like to extend an offer...',
    now() - interval '1 day'
  )
  on conflict (user_id, gmail_message_id) do nothing;

  -- sample classification
  insert into classifications (message_id, user_id, label, confidence, method, reason)
  values (
    v_msg_id,
    v_user_id,
    'acceptance',
    0.95,
    'rules',
    'Matched keywords: "excited to offer", "congratulations"'
  );
end $$;
