import { createHmac } from 'crypto'

function secret() {
  const s = process.env.INGESTION_SHARED_SECRET
  if (!s) throw new Error('Missing INGESTION_SHARED_SECRET')
  return s
}

export function signState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url')
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyState(state: string): string {
  const [payload, sig] = state.split('.')
  if (!payload || !sig) throw new Error('Invalid state')
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url')
  if (expected !== sig) throw new Error('State signature mismatch')
  const { userId, ts } = JSON.parse(Buffer.from(payload, 'base64url').toString())
  if (Date.now() - ts > 10 * 60 * 1000) throw new Error('State expired')
  return userId as string
}
