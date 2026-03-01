'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PhoneForm({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('error'); return }

    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: phone })
      .eq('id', user.id)

    setStatus(error ? 'error' : 'saved')
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="flex gap-3">
        <input
          type="tel"
          placeholder="+12345678900"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setStatus('idle') }}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {status === 'saved' && <p className="text-sm text-green-600">Phone number saved.</p>}
      {status === 'error' && <p className="text-sm text-red-500">Failed to save. Try again.</p>}
    </form>
  )
}
