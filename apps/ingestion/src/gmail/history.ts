const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

interface HistoryResponse {
  history?: Array<{
    messagesAdded?: Array<{ message: { id: string } }>
  }>
  historyId?: string
}

export async function listNewMessageIds(
  accessToken: string,
  startHistoryId: string
): Promise<string[]> {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: 'messageAdded',
    labelId: 'INBOX',
  })

  const res = await fetch(`${GMAIL_BASE}/history?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail history list failed: ${body}`)
  }

  const json = await res.json() as HistoryResponse

  const ids: string[] = []
  for (const record of json.history ?? []) {
    for (const added of record.messagesAdded ?? []) {
      ids.push(added.message.id)
    }
  }

  // Deduplicate — same message can appear in multiple history records
  return [...new Set(ids)]
}
