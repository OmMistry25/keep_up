import type { GmailMessage } from './messages'

export type ParsedMessage = {
  gmail_message_id: string
  thread_id: string
  from_email: string
  from_name: string
  subject: string
  snippet: string
  received_at: string
  raw_headers: Record<string, string>
}

export function parseMessage(msg: GmailMessage): ParsedMessage {
  const headerMap: Record<string, string> = {}
  for (const h of msg.payload.headers) {
    headerMap[h.name.toLowerCase()] = h.value
  }

  const { from_name, from_email } = parseFrom(headerMap['from'] ?? '')
  const received_at = new Date(parseInt(msg.internalDate, 10)).toISOString()

  return {
    gmail_message_id: msg.id,
    thread_id: msg.threadId,
    from_name,
    from_email,
    subject: headerMap['subject'] ?? '',
    snippet: msg.snippet ?? '',
    received_at,
    raw_headers: headerMap,
  }
}

// Parses "Name <email@example.com>" or plain "email@example.com"
function parseFrom(from: string): { from_name: string; from_email: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return {
      from_name: match[1].replace(/^"|"$/g, '').trim(),
      from_email: match[2].trim().toLowerCase(),
    }
  }
  return { from_name: '', from_email: from.trim().toLowerCase() }
}
