'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import BrandLogo from '@/app/components/BrandLogo'
import AcknowledgementFields from '@/app/components/AcknowledgementFields'

export default function SignUpPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [handbook, setHandbook] = useState({ url: '', version: '' })
  const [releaseLiabilityAgreed, setReleaseLiabilityAgreed] = useState(false)
  const [contactInfoRelease, setContactInfoRelease] = useState<'agree' | 'do_not_agree' | ''>('')
  const [photographyRelease, setPhotographyRelease] = useState<'agree' | 'do_not_agree' | ''>('')
  const [handbookAgreed, setHandbookAgreed] = useState(false)

  useEffect(() => {
    fetch('/api/auth/acknowledgements')
      .then((response) => response.json())
      .then((payload) => setHandbook({ url: payload.handbookUrl || '', version: payload.handbookVersion || '' }))
      .catch(() => setHandbook({ url: '', version: '' }))
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          releaseLiabilityAgreed,
          contactInfoRelease,
          photographyRelease,
          handbookAgreed
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Unable to create account')
        return
      }

       router.push('/signin?pending=1')
    } catch (err) {
      console.error('Error signing up:', err)
      setError('Unable to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex justify-center mb-4">
          <BrandLogo variant="icon" width={64} alt="DVCLC" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Create account</h1>
        <p className="mt-2 text-sm text-gray-600">Set up your local DVCLC login.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white"
              required
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white"
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/signin" className="text-blue-600 hover:text-blue-800">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
