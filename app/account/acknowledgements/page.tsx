'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-client'
import AcknowledgementFields from '@/app/components/AcknowledgementFields'

export default function AcknowledgementsPage() {
  const { user, loading, refresh } = useAuth()
  const router = useRouter()
  const [handbook, setHandbook] = useState({ url: '', version: '' })
  const [releaseLiabilityAgreed, setReleaseLiabilityAgreed] = useState(false)
  const [contactInfoRelease, setContactInfoRelease] = useState<'agree' | 'do_not_agree' | ''>('')
  const [photographyRelease, setPhotographyRelease] = useState<'agree' | 'do_not_agree' | ''>('')
  const [handbookAgreed, setHandbookAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isReactivation, setIsReactivation] = useState(false)

  useEffect(() => {
    setIsReactivation(new URLSearchParams(window.location.search).get('reactivate') === '1')
    if (!loading && !user) {
      router.push('/signin')
      return
    }

    fetch('/api/auth/acknowledgements')
      .then((response) => response.json())
      .then((payload) => setHandbook({ url: payload.handbookUrl || '', version: payload.handbookVersion || '' }))
      .catch(() => setError('Unable to load the current handbook'))
  }, [loading, router, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/acknowledgements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseLiabilityAgreed, contactInfoRelease, photographyRelease, handbookAgreed })
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Unable to save acknowledgement')
        return
      }

      await refresh()
      router.push(payload.reactivationPending ? '/signin?reactivation=1' : '/dashboard')
    } catch (submitError) {
      console.error('Error saving acknowledgement:', submitError)
      setError('Unable to save acknowledgement')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen bg-gray-50" />
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-gray-900">{isReactivation ? 'Reactivate your account' : 'Updated acknowledgements required'}</h1>
        <p className="mt-2 text-sm text-gray-600">{isReactivation ? 'Refresh these acknowledgements to send your account back to the administrator approval queue.' : 'Please review these acknowledgements before continuing. A new handbook version requires this confirmation again.'}</p>
        <form className="mt-6" onSubmit={handleSubmit}>
          <AcknowledgementFields
            releaseLiabilityAgreed={releaseLiabilityAgreed}
            contactInfoRelease={contactInfoRelease}
            photographyRelease={photographyRelease}
            handbookAgreed={handbookAgreed}
            handbookUrl={handbook.url}
            handbookVersion={handbook.version}
            onReleaseLiabilityChange={setReleaseLiabilityAgreed}
            onContactInfoReleaseChange={setContactInfoRelease}
            onPhotographyReleaseChange={setPhotographyRelease}
            onHandbookChange={setHandbookAgreed}
          />
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400">
            {submitting ? 'Saving...' : isReactivation ? 'Request reactivation' : 'Save acknowledgements'}
          </button>
        </form>
      </div>
    </div>
  )
}
