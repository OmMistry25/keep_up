export type MessageRow = {
  id: string
  from_name: string | null
  from_email: string | null
  subject: string | null
  snippet: string | null
  received_at: string | null
  label: string | null
  confidence: number | null
}

export default function MessageTable({ rows }: { rows: MessageRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-400">
        No messages yet — connect Gmail and run a sync.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Label</th>
            <th className="px-4 py-3">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{row.from_name || row.from_email || '—'}</td>
              <td className="px-4 py-3 text-gray-700 max-w-sm truncate">{row.subject ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${labelClass(row.label)}`}>
                  {row.label ?? 'unknown'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {row.received_at ? new Date(row.received_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function labelClass(label: string | null) {
  switch (label) {
    case 'acceptance':  return 'bg-green-100 text-green-700'
    case 'rejection':   return 'bg-red-100 text-red-700'
    case 'interview':   return 'bg-blue-100 text-blue-700'
    case 'assessment':  return 'bg-purple-100 text-purple-700'
    case 'other':       return 'bg-gray-100 text-gray-600'
    default:            return 'bg-yellow-100 text-yellow-700'
  }
}
