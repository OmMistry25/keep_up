export type ClassifyResult = {
  label: 'acceptance' | 'rejection' | 'interview' | 'assessment' | 'other' | 'unsure'
  confidence: number
  reason: string
  method: 'rules' | 'llm'
}

// Only unambiguous multi-word phrases that appear exclusively in job-related emails.
// Single common words (e.g. "congratulations", "unfortunately", "invitation") are intentionally
// excluded — they appear in promotions, LinkedIn, account activations, etc.
// Those borderline cases are delegated to the LLM.

const REJECTION_KEYWORDS = [
  'not moving forward',
  'we went with another candidate',
  'not selected for',
  'position has been filled',
  'decided not to move forward',
  'will not be moving forward',
  'not a fit for',
  'pursue other candidates',
  'chosen another candidate',
  'regret to inform you',
  'we have decided to move forward with other',
]

const ACCEPTANCE_KEYWORDS = [
  'offer letter',
  'we are excited to offer',
  'pleased to offer you',
  'we would like to offer you',
  'welcome to the team',
  'thrilled to offer',
  'happy to offer you',
  'extend an offer',
  'formal offer',
  'your start date',
]

// Only explicit interview-scheduling phrases — no generic "invitation", "onsite", "set up a call"
const INTERVIEW_KEYWORDS = [
  'schedule an interview',
  'invite you to interview',
  'interview with our team',
  'phone screen',
  'video interview',
  'on-site interview',
  'onsite interview',
  'technical interview',
  'interview invitation',
  'next steps in the interview',
]

// Assessment keywords are already specific tool/process names — no changes needed
const ASSESSMENT_KEYWORDS = [
  'coding assessment',
  'technical assessment',
  'take-home assignment',
  'take-home project',
  'hackerrank',
  'codility',
  'codesignal',
  'online assessment',
  'coding challenge',
  'technical challenge',
  'skills assessment',
]

// Sender domains that should never be classified as job-related.
// These are meeting recorders, productivity tools, social platforms, etc.
// Checked before any keyword matching or LLM call.
const BLOCKED_SENDER_DOMAINS = [
  'fathom.video',          // meeting recorder
  'otter.ai',              // meeting recorder
  'fireflies.ai',          // meeting recorder
  'zoom.us',               // video conferencing
  'linkedin.com',          // social / connection requests
  'notifications.linkedin.com',
  'mail.linkedin.com',
]

// Known ATS / recruiting platform sender domains — used to boost confidence only
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

export function isSenderBlocked(from_email: string): boolean {
  const domain = from_email.split('@')[1] ?? ''
  return BLOCKED_SENDER_DOMAINS.some((d) => domain.endsWith(d))
}

export function classifyByRules(params: {
  subject: string
  snippet: string
  from_email: string
}): ClassifyResult {
  const domain = params.from_email.split('@')[1] ?? ''

  // Hard-block known non-job senders before any keyword or LLM processing
  if (BLOCKED_SENDER_DOMAINS.some((d) => domain.endsWith(d))) {
    return {
      label: 'other',
      confidence: 1.0,
      reason: `Blocked sender domain: ${domain}`,
      method: 'rules',
    }
  }

  const text = `${params.subject} ${params.snippet}`.toLowerCase()
  const isAts = ATS_DOMAINS.some((d) => domain.endsWith(d))

  const accMatches = ACCEPTANCE_KEYWORDS.filter((kw) => text.includes(kw))
  const rejMatches = REJECTION_KEYWORDS.filter((kw) => text.includes(kw))
  const asmMatches = ASSESSMENT_KEYWORDS.filter((kw) => text.includes(kw))
  const intMatches = INTERVIEW_KEYWORDS.filter((kw) => text.includes(kw))

  // All labels require 2+ matches to fire from rules alone.
  // Single matches fall through to LLM for contextual judgment.

  // Acceptance — highest priority
  if (accMatches.length >= 2 && rejMatches.length === 0) {
    return {
      label: 'acceptance',
      confidence: round(Math.min(0.95, 0.7 + accMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${accMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Rejection
  if (rejMatches.length >= 2 && accMatches.length === 0) {
    return {
      label: 'rejection',
      confidence: round(Math.min(0.95, 0.7 + rejMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${rejMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Assessment
  if (asmMatches.length >= 2 && rejMatches.length === 0) {
    return {
      label: 'assessment',
      confidence: round(Math.min(0.95, 0.7 + asmMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${asmMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Interview
  if (intMatches.length >= 2 && rejMatches.length === 0) {
    return {
      label: 'interview',
      confidence: round(Math.min(0.95, 0.7 + intMatches.length * 0.1 + (isAts ? 0.05 : 0))),
      reason: `Matched: ${intMatches.join(', ')}`,
      method: 'rules',
    }
  }

  // Mixed signals — both acceptance and rejection found, human review needed
  if (rejMatches.length >= 2 && accMatches.length >= 2) {
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
