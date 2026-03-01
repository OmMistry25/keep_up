import OpenAI from 'openai'
import { env } from '../config/env'
import type { ClassifyResult } from './rules'

const LABELS = ['acceptance', 'rejection', 'interview', 'assessment', 'other'] as const
type Label = (typeof LABELS)[number]

const SYSTEM_PROMPT = `You are a classifier for a job application tracker. Your job is to read an email's sender, subject, and snippet and decide if it is directly related to a job application the user submitted.

Classify using exactly one of these labels:
- acceptance  → the company is formally offering the user a job (offer letter, compensation, start date)
- rejection   → the company says they are not moving forward with the user's application
- interview   → a recruiter or company is scheduling or confirming a job interview, phone screen, or onsite
- assessment  → the company sent a coding challenge, take-home test, or technical assessment for the user to complete
- other       → everything else

STRICT RULES — you must follow these exactly:
1. If the email is from LinkedIn, return "other". LinkedIn connection requests, job suggestions, and "You have an invitation" from LinkedIn are NOT interviews.
2. If the email is a newsletter, promotion, sale, account activation, or transaction alert, return "other".
3. "Congratulations" alone does NOT mean acceptance. It must be clearly about a job offer.
4. "You have an invitation" alone does NOT mean interview. It must clearly come from a company scheduling a job interview.
5. Calendar event recaps or Google Meet summaries are NOT interviews unless the subject clearly states it is a job interview.
6. Sales emails asking to "set up a call" or "chat" are NOT interviews.
7. Only return a job-related label if you are highly confident this email is part of a job application process the user is actively in.
8. When in doubt, return "other".

Respond with only the label word. Nothing else.`

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  }
  return client
}

export async function classifyByLLM(params: {
  subject: string
  body: string
  from_email: string
}): Promise<ClassifyResult & { method: 'llm' }> {
  const userMessage = `From: ${params.from_email}\nSubject: ${params.subject}\nBody:\n${params.body}`

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 10,
    temperature: 0,
  })

  const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? 'other'
  const label: Label = LABELS.includes(raw as Label) ? (raw as Label) : 'other'

  return {
    label,
    confidence: 0.85,
    reason: `LLM (gpt-4o-mini): ${label}`,
    method: 'llm',
  }
}
