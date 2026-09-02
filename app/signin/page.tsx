'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import BrandLogo from '@/app/components/BrandLogo'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pendingNotice = searchParams.get('pending') === '1'
  const reactivationNotice = searchParams.get('reactivation') === '1'

  const next = searchParams.get('next') || '/dashboard'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const payload = await response.json()
      if (!response.ok) {
        if (payload.accountParked) {
          await refresh()
          router.push('/account/acknowledgements?reactivate=1')
          return
        }
        setError(payload.error || 'Unable to sign in')
        return
      }

      await refresh()
      if (payload.mustResetPassword) {
        router.push('/account')
        return
      }
      if (payload.requiresAcknowledgement) {
        router.push('/account/acknowledgements')
        return
      }
      router.push(next)
    } catch (err) {
      console.error('Error signing in:', err)
      setError('Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex justify-center mb-4">
          <BrandLogo variant="icon" width={64} alt="DVCLC" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="mt-2 text-sm text-gray-600">Sign in to Desert Valley Creative Learning Collaborative co-op with your email and password.</p>
        {pendingNotice && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">Your account was created and is waiting for administrator approval.</p>}
        {reactivationNotice && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">Your account is pending reactivation approval. Sign in again after an administrator approves it.</p>}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600 flex justify-between">
          <Link href="/forgot-password" className="text-blue-600 hover:text-blue-800">Forgot password?</Link>
          <Link href="/signup" className="text-blue-600 hover:text-blue-800">Create account</Link>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SignInForm />
    </Suspense>
  )
}
