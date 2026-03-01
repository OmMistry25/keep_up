import { Router } from 'express'
import { env } from '../../config/env'
import {
  getConnectionByEmail,
  updateLastHistoryId,
  getUserPhone,
  upsertMessage,
} from '../../storage/supabase'
import { getAccessToken } from '../../gmail/oauth'
import { listNewMessageIds } from '../../gmail/history'
import { getMessage } from '../../gmail/messages'
import { parseMessage } from '../../gmail/parse'
import { classify, storeClassification } from '../../classify/classifier'
import { notifyZapier } from '../../notify/zapier'

const router = Router()

router.post('/pubsub/push', async (req, res) => {
  // Validate shared token
  const token = req.query['token'] as string | undefined
  if (env.PUBSUB_VERIFICATION_TOKEN && token !== env.PUBSUB_VERIFICATION_TOKEN) {
    res.status(403).json({ error: 'Invalid token' })
    return
  }

  // Acknowledge immediately — Pub/Sub retries if we don't respond quickly
  res.status(204).send()

  try {
    const envelope = req.body as { message?: { data?: string } }
    if (!envelope.message?.data) return

    const decoded = JSON.parse(
      Buffer.from(envelope.message.data, 'base64').toString()
    ) as { emailAddress: string; historyId: string }

    const { emailAddress, historyId: newHistoryId } = decoded

    const connection = await getConnectionByEmail(emailAddress)
    if (!connection) {
      console.log(`[pubsub] No connection found for ${emailAddress}`)
      return
    }

    const { user_id, last_history_id } = connection

    // First notification — just save the historyId, no messages to process yet
    if (!last_history_id) {
      await updateLastHistoryId(user_id, newHistoryId)
      return
    }

    const accessToken = await getAccessToken(user_id)
    const messageIds = await listNewMessageIds(accessToken, last_history_id)

    // Update historyId before processing so retries don't reprocess
    await updateLastHistoryId(user_id, newHistoryId)

    const phone = await getUserPhone(user_id)

    for (const msgId of messageIds) {
      try {
        const raw = await getMessage(accessToken, msgId)
        const parsed = parseMessage(raw)

        const result = await classify({
          subject: parsed.subject,
          snippet: parsed.snippet,
          body: parsed.body,
          from_email: parsed.from_email,
        })

        console.log(`[pubsub] "${parsed.subject}" [${parsed.from_email}] → ${result.method}:${result.label}`)

        if (result.label === 'other') continue

        const messageUuid = await upsertMessage(user_id, parsed)
        await storeClassification(user_id, messageUuid, parsed, result)

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
      } catch (err) {
        console.error(`[pubsub] Error processing message ${msgId}:`, err)
      }
    }
  } catch (err) {
    console.error('[pubsub] Error:', err)
  }
})

export default router
