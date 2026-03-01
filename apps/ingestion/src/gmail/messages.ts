const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

function headers(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function getProfile(accessToken: string): Promise<{
  emailAddress: string
  historyId: string
}> {
  const res = await fetch(`${GMAIL_BASE}/profile`, { headers: headers(accessToken) })
  if (!res.ok) throw new Error(`getProfile failed: ${res.status}`)
  return res.json()
}

export async function listMessageIds(
  accessToken: string,
  maxResults = 20
): Promise<string[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    labelIds: 'INBOX',   // only received emails — excludes Sent, Drafts, Spam
  })
  const res = await fetch(`${GMAIL_BASE}/messages?${params}`, { headers: headers(accessToken) })
  if (!res.ok) throw new Error(`listMessages failed: ${res.status}`)
  const json = await res.json() as { messages?: { id: string }[] }
  return (json.messages ?? []).map((m) => m.id)
}

export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  // format=full returns the complete payload including body parts
  const params = new URLSearchParams({ format: 'full' })
  const res = await fetch(`${GMAIL_BASE}/messages/${messageId}?${params}`, {
    headers: headers(accessToken),
  })
  if (!res.ok) throw new Error(`getMessage failed: ${res.status} for ${messageId}`)
  return res.json()
}

export type GmailMessagePart = {
  mimeType: string
  headers?: { name: string; value: string }[]
  body?: { data?: string; size?: number }
  parts?: GmailMessagePart[]
}

export type GmailMessage = {
  id: string
  threadId: string
  snippet: string
  payload: GmailMessagePart & {
    headers: { name: string; value: string }[]
  }
  internalDate: string
}
