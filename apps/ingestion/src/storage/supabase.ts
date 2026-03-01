import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env'
import type { ParsedMessage } from '../gmail/parse'

// Single shared admin client — bypasses RLS via service role key
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

export async function logIngestionEvent(params: {
  user_id?: string
  event_type: string
  payload?: Record<string, unknown>
  status: 'ok' | 'error'
  error?: string
}) {
  const { error } = await supabase.from('ingestion_events').insert({
    user_id: params.user_id ?? null,
    event_type: params.event_type,
    payload: params.payload ?? null,
    status: params.status,
    error: params.error ?? null,
  })

  if (error) console.error('[supabase] logIngestionEvent failed:', error.message)
}

// Returns the message UUID (existing or newly inserted)
export async function upsertMessage(
  userId: string,
  msg: ParsedMessage
): Promise<string> {
  const { data, error } = await supabase
    .from('messages')
    .upsert(
      {
        user_id: userId,
        gmail_message_id: msg.gmail_message_id,
        thread_id: msg.thread_id,
        from_email: msg.from_email,
        from_name: msg.from_name,
        subject: msg.subject,
        snippet: msg.snippet,
        received_at: msg.received_at,
        raw_headers: msg.raw_headers,
      },
      { onConflict: 'user_id,gmail_message_id' }
    )
    .select('id')
    .single()

  if (error) throw new Error(`upsertMessage failed: ${error.message}`)
  return data.id as string
}

export async function insertClassification(params: {
  message_id: string
  user_id: string
  label: string
  confidence: number
  method: string
  reason: string
  links: string[]
}) {
  const { error } = await supabase.from('classifications').insert(params)
  if (error) throw new Error(`insertClassification failed: ${error.message}`)
}
