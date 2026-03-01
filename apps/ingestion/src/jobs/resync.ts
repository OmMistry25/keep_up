import { getAccessToken } from '../gmail/oauth'
import { listMessageIds, getMessage } from '../gmail/messages'
import { parseMessage } from '../gmail/parse'
import { upsertMessage, logIngestionEvent, getUserPhone } from '../storage/supabase'
import { classify, storeClassification } from '../classify/classifier'
import { notifyZapier } from '../notify/zapier'

export async function runResync(userId: string, maxResults = 20): Promise<number> {
  const accessToken = await getAccessToken(userId)
  const messageIds = await listMessageIds(accessToken, maxResults)

  // Fetch the user's phone number once before the loop
  const phone = await getUserPhone(userId)

  let processed = 0

  for (const id of messageIds) {
    try {
      const raw = await getMessage(accessToken, id)
      const parsed = parseMessage(raw)

      // Single classify call: rules first, LLM fallback if rules say 'other'
      const result = await classify({
        subject: parsed.subject,
        snippet: parsed.snippet,
        body: parsed.body,
        from_email: parsed.from_email,
      })

      console.log(`[resync] "${parsed.subject}" [${parsed.from_email}] → ${result.method}:${result.label}`)

      if (result.label === 'other') continue

      const messageUuid = await upsertMessage(userId, parsed)
      await storeClassification(userId, messageUuid, parsed, result)

      // Notify via Zapier if user has a phone number on file
      if (phone) {
        await notifyZapier({
          to: phone,
          label: result.label,
          subject: parsed.subject,
          from_name: parsed.from_name,
          from_email: parsed.from_email,
          received_at: parsed.received_at,
        })
      }

      processed++
    } catch (err) {
      console.error(`[resync] failed for message ${id}:`, err)
    }
  }

  await logIngestionEvent({
    user_id: userId,
    event_type: 'resync',
    payload: { maxResults, processed },
    status: 'ok',
  })

  return processed
}
