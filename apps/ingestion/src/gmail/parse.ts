import type { GmailMessage, GmailMessagePart } from './messages'

// Max characters of body text passed to classifier — enough for LLM context, avoids token bloat
const BODY_MAX_CHARS = 3000

export type ParsedMessage = {
  gmail_message_id: string
  thread_id: string
  from_email: string
  from_name: string
  subject: string
  snippet: string
  body: string        // plain text body, truncated — used for classification
  received_at: string
  raw_headers: Record<string, string>
}

export function parseMessage(msg: GmailMessage): ParsedMessage {
  const headerMap: Record<string, string> = {}
  for (const h of msg.payload?.headers ?? []) {
    headerMap[h.name.toLowerCase()] = h.value
  }

  const { from_name, from_email } = parseFrom(headerMap['from'] ?? '')
  const received_at = new Date(parseInt(msg.internalDate, 10)).toISOString()
  const body = extractBody(msg.payload)

  return {
    gmail_message_id: msg.id,
    thread_id: msg.threadId,
    from_name,
    from_email,
    subject: headerMap['subject'] ?? '',
    snippet: msg.snippet ?? '',
    body,
    received_at,
    raw_headers: headerMap,
  }
}

/**
 * Recursively walks the Gmail payload tree to extract plain text.
 * Prefers text/plain over text/html. Falls back to snippet if nothing found.
 */
function extractBody(part: GmailMessagePart): string {
  // Prefer plain text
  const plain = findPart(part, 'text/plain')
  if (plain?.body?.data) {
    return decodeBase64url(plain.body.data).slice(0, BODY_MAX_CHARS)
  }

  // Fall back to HTML — strip tags for clean text
  const html = findPart(part, 'text/html')
  if (html?.body?.data) {
    const raw = decodeBase64url(html.body.data)
    return stripHtml(raw).slice(0, BODY_MAX_CHARS)
  }

  return ''
}

/**
 * Recursively finds the first part matching the given mimeType.
 */
function findPart(part: GmailMessagePart, mimeType: string): GmailMessagePart | null {
  if (part.mimeType === mimeType) return part
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType)
    if (found) return found
  }
  return null
}

/**
 * Decodes a base64url-encoded string (Gmail uses base64url, not standard base64).
 */
function decodeBase64url(data: string): string {
  // Convert base64url to standard base64, then decode
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

/**
 * Strips HTML tags and collapses whitespace for clean plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
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
