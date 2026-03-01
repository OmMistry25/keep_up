export type ClassifyResult = {
  label: 'acceptance' | 'rejection' | 'interview' | 'assessment' | 'other' | 'unsure'
  confidence: number
  reason: string
  method: 'rules'
}

const REJECTION_KEYWORDS = [
  'unfortunately',
  'not moving forward',
  'we went with another candidate',
  'other candidates',
  'not selected',
  'position has been filled',
  'decided not to move',
  'will not be moving forward',
  'not a fit',
  'pursue other candidates',
  'chosen another',
  'regret to inform',
  'after careful consideration',
]

const ACCEPTANCE_KEYWORDS = [
  'offer letter',
  'we are excited to offer',
  'pleased to offer',
  'we would like to offer',
  'welcome to the team',
  'congratulations',
  'thrilled to offer',
  'happy to offer',
  'extend an offer',
  'formal offer',
]

const INTERVIEW_KEYWORDS = [
  'schedule an interview',
  'invite you to interview',
  'next round',
  'moving you forward',
  'phone screen',
  'video interview',
  'on-site',
  'technical interview',
  "we'd like to chat",
  'we would like to speak',
  'set up a call',
  'interview invitation',
]

const ASSESSMENT_KEYWORDS = [
  'coding assessment',
  'technical assessment',
  'take-home',
  'hackerrank',
  'codility',
  'codesignal',
  'complete the following',
  'online assessment',
  'coding challenge',
  'technical challenge',
  'skills assessment',
]

// Known ATS / recruiting platform sender domains
const ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'workday.com',
  'ashbyhq.com',
  'smartrecruiters.com',
  'jobvite.com',
  'icims.com',
  'myworkdayjobs.com',
]

export function classifyByRules(params: {
  subject: string
  snippet: string
  from_email: string
}): ClassifyResult {
  const text = `${params.subject} ${params.snippet}`.toLowerCase()
  const domain = params.from_email.split('@')[1] ?? ''
  const isAts = ATS_DOMAINS.some((d) => domain.endsWith(d))

  const accMatches  = ACCEPTANCE_KEYWORDS.filter((kw) => text.includes(kw))
  const rejMatches  = REJECTION_KEYWORDS.filter((kw) => text.includes(kw))
  const asmMatches  = ASSESSMENT_KEYWORDS.filter((kw) => text.includes(kw))
  const intMatches  = INTERVIEW_KEYWORDS.filter((kw) => text.includes(kw))

  // Acceptance (highest priority — explicit offer)
  if (accMatches.length > 0 && rejMatches.length === 0) {
    return {
      label: 'acceptance',
      confidence: round(Math.min(0.95, 0.7 + accMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${accMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Rejection
  if (rejMatches.length > 0 && accMatches.length === 0) {
    return {
      label: 'rejection',
      confidence: round(Math.min(0.95, 0.7 + rejMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${rejMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Assessment (before interview — more specific)
  if (asmMatches.length > 0 && rejMatches.length === 0) {
    return {
      label: 'assessment',
      confidence: round(Math.min(0.95, 0.7 + asmMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${asmMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Interview invite
  if (intMatches.length > 0 && rejMatches.length === 0) {
    return {
      label: 'interview',
      confidence: round(Math.min(0.95, 0.7 + intMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${intMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Mixed signals
  if (rejMatches.length > 0 && accMatches.length > 0) {
    return {
      label: 'unsure',
      confidence: 0.4,
      reason: `Mixed signals — rejection: [${rejMatches.join(', ')}], acceptance: [${accMatches.join(', ')}]`,
      method: 'rules',
    }
  }

  return {
    label: 'other',
    confidence: 1.0,
    reason: 'No job-related keywords matched',
    method: 'rules',
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
