import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: connection } = await supabase
    .from('gmail_connections')
    .select('email_address, status, watch_expiration, updated_at')
    .eq('user_id', user!.id)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <a href="/dashboard" className="text-sm text-gray-500 hover:underline">← Dashboard</a>
      </div>

      {/* Gmail connection status */}
      <section className="rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Gmail Connection</h2>

        {connection?.status === 'connected' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusDot status={connection.status} />
              <span className="text-sm font-medium capitalize">{connection.status}</span>
            </div>
            <p className="text-sm text-gray-500">Connected as <strong>{connection.email_address}</strong></p>
            {connection.watch_expiration && (
              <p className="text-sm text-gray-400">
                Watch expires: {new Date(connection.watch_expiration).toLocaleDateString()}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <form action="/api/gmail/resync" method="POST">
                <button
                  type="submit"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Resync
                </button>
              </form>
              <form action="/api/gmail/disconnect" method="POST">
                <button
                  type="submit"
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">No Gmail account connected yet.</p>
            <a
              href="/api/gmail/connect"
              className="inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Connect Gmail
            </a>
          </div>
        )}
      </section>

      {/* Notifications */}
      <section className="rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-gray-500">
          Get notified when job-related emails are detected. Join the Discord server to receive updates.
        </p>
        <a
          href="https://discord.gg/sjCwGKwpYQ"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752C4]"
        >
          Join Discord Server
        </a>
      </section>
    </main>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected' ? 'bg-green-500' :
    status === 'error'     ? 'bg-red-500' :
                             'bg-gray-400'
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
}
