import { classifyByRules, isSenderBlocked, type ClassifyResult } from './rules'
import { classifyByLLM } from './llm'
import { env } from '../config/env'
import type { ParsedMessage } from '../gmail/parse'
import { insertClassification } from '../storage/supabase'

const URL_REGEX = /https?:\/\/[^\s"'<>)]+/g

function extractLinks(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) ?? [])]
}

/**
 * Runs the full classification pipeline: rules first, LLM fallback if rules say 'other'.
 * Returns a single result — no double LLM calls.
 */
export async function classify(params: {
  subject: string
  snippet: string
  body: string
  from_email: string
}): Promise<ClassifyResult> {
  const rulesResult = classifyByRules({
    subject: params.subject,
    snippet: params.snippet,
    from_email: params.from_email,
  })

  if (rulesResult.label !== 'other') {
    return rulesResult
  }

  // Blocked senders are hard 'other' — never escalate to LLM
  if (isSenderBlocked(params.from_email)) {
    return rulesResult
  }

  if (env.LLM_ENABLED && env.OPENAI_API_KEY) {
    return classifyByLLM({
      subject: params.subject,
      body: params.body || params.snippet,
      from_email: params.from_email,
    })
  }

  return rulesResult
}

/**
 * Stores a pre-computed classification result. Caller is responsible for
 * running classify() first — this avoids redundant LLM calls.
 */
export async function storeClassification(
  userId: string,
  messageId: string,
  msg: ParsedMessage,
  result: ClassifyResult
): Promise<void> {
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
