import { supabase } from '../storage/supabase'
import { decrypt } from '../storage/crypto'
import { env } from '../config/env'

export async function getAccessToken(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('refresh_token_enc, status')
    .eq('user_id', userId)
    .single()

  if (error || !data) throw new Error(`No Gmail connection found for user ${userId}`)
  if (data.status !== 'connected') throw new Error(`Gmail connection is ${data.status}`)
  if (!data.refresh_token_enc) throw new Error('No refresh token stored')

  const refreshToken = decrypt(data.refresh_token_enc)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed: ${body}`)
  }

  const json = await res.json() as { access_token: string }
  return json.access_token
}
