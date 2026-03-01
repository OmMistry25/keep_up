const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

export async function setupWatch(
  accessToken: string,
  topicName: string
): Promise<{ historyId: string; expiration: string }> {
  const res = await fetch(`${GMAIL_BASE}/watch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName,
      labelIds: ['INBOX'],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail watch setup failed: ${body}`)
  }

  return res.json() as Promise<{ historyId: string; expiration: string }>
}
