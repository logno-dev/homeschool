'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResumeRegistration({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resume = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/registration/resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || payload.conflicts?.map((conflict: { message: string }) => conflict.message).join(' ') || payload.message || 'Unable to complete registration')
      router.push('/family/payments')
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to complete registration')
    } finally { setBusy(false) }
  }

  return <div className="mt-4 space-y-2">
    <button type="button" onClick={resume} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Completing registration…' : 'Complete registration and continue to payment'}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>
}
