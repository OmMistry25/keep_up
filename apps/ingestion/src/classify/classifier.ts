import { classifyByRules } from './rules'
import type { ParsedMessage } from '../gmail/parse'
import { insertClassification } from '../storage/supabase'

const URL_REGEX = /https?:\/\/[^\s"'<>)]+/g

function extractLinks(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) ?? [])]
}

export async function classifyAndStore(
  userId: string,
  messageId: string,
  msg: ParsedMessage
): Promise<void> {
  const result = classifyByRules({
    subject: msg.subject,
    snippet: msg.snippet,
    from_email: msg.from_email,
  })

  const links = extractLinks(`${msg.subject} ${msg.snippet}`)

  await insertClassification({
    message_id: messageId,
    user_id: userId,
    label: result.label,
    confidence: result.confidence,
    method: result.method,
    reason: result.reason,
    links,
  })
}
