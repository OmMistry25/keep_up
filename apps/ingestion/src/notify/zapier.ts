import { env } from '../config/env'

export type ZapierPayload = {
  to: string
  label: string
  subject: string
  from_name: string
  from_email: string
  received_at: string
}

/**
 * POSTs classification details to the Zapier webhook.
 * Fails silently — a notification failure must never crash the ingestion pipeline.
 */
export async function notifyZapier(payload: ZapierPayload): Promise<void> {
  if (!env.ZAPIER_WEBHOOK_URL) {
    console.warn('[zapier] ZAPIER_WEBHOOK_URL not set — skipping notification')
    return
  }

  try {
    const res = await fetch(env.ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error(`[zapier] webhook returned ${res.status}`)
    } else {
      console.log(`[zapier] notified for label:${payload.label} to:${payload.to}`)
    }
  } catch (err) {
    console.error('[zapier] failed to POST webhook:', err)
  }
}
