import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getServerEnv } from '@/lib/config/env'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const env = getServerEnv()
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY
  )

  await admin
    .from('gmail_connections')
    .update({
      refresh_token_enc: null,
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  return NextResponse.redirect(new URL('/settings', request.url))
}
