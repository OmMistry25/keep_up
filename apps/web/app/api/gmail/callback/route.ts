import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getServerEnv } from '@/lib/config/env'
import { verifyState } from '@/lib/auth/oauthState'
import { encrypt } from '@/lib/crypto/tokens'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${origin}/settings?error=gmail_denied`)
  }

  let userId: string
  try {
    userId = verifyState(state)
  } catch {
    return NextResponse.redirect(`${origin}/settings?error=invalid_state`)
  }

  // Verify the session user matches state
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const env = getServerEnv()
  const redirectUri = `${origin}/api/gmail/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/settings?error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    scope: string
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${origin}/settings?error=no_refresh_token`)
  }

  // Fetch Gmail profile to get email + google subject
  const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!profileRes.ok) {
    return NextResponse.redirect(`${origin}/settings?error=profile_fetch_failed`)
  }

  const profile = await profileRes.json() as {
    emailAddress: string
    historyId: string
  }

  // Persist using service role (bypasses RLS)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Ensure profile row exists (for users created before the auto-trigger)
  await admin.from('profiles').upsert({ id: userId }, { onConflict: 'id' })

  await admin.from('gmail_connections').upsert(
    {
      user_id: userId,
      google_subject: profile.emailAddress,
      email_address: profile.emailAddress,
      refresh_token_enc: encrypt(tokens.refresh_token),
      scopes: tokens.scope.split(' '),
      last_history_id: profile.historyId,
      status: 'connected',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  return NextResponse.redirect(`${origin}/settings?connected=1`)
}
