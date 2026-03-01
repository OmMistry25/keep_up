import { createClient } from '@/lib/supabase/server'
import MessageTable, { type MessageRow } from './components/MessageTable'
import RealtimeProvider from './components/RealtimeProvider'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from('messages')
    .select(`
      id,
      from_name,
      from_email,
      subject,
      snippet,
      received_at,
      classifications (label, confidence)
    `)
    .order('received_at', { ascending: false })
    .limit(50)

  const tableRows: MessageRow[] = (rows ?? []).map((m) => {
    const classification = Array.isArray(m.classifications)
      ? m.classifications[0]
      : m.classifications
    return {
      id: m.id,
      from_name: m.from_name,
      from_email: m.from_email,
      subject: m.subject,
      snippet: m.snippet,
      received_at: m.received_at,
      label: classification?.label ?? null,
      confidence: classification?.confidence ?? null,
    }
  })

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      {user && <RealtimeProvider userId={user.id} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <a href="/settings" className="text-sm text-gray-500 hover:underline">Settings</a>
      </div>
      <MessageTable rows={tableRows} />
    </main>
  )
}
