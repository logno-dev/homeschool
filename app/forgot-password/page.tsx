'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [resetUrl, setResetUrl] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setResetUrl('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const payload = await response.json()
      setMessage(payload.message || 'If an account exists, a reset email has been sent.')
      if (payload.resetUrl) {
        setResetUrl(payload.resetUrl)
      }
    } catch (error) {
      console.error('Error requesting password reset:', error)
      setMessage('Unable to process reset request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Forgot password</h1>
        <p className="mt-2 text-sm text-gray-600">Enter your email and we will send you a reset link.</p>

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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? 'Sending email...' : 'Send reset email'}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        {resetUrl && (
          <p className="mt-2 text-sm text-blue-700 break-all">
            Dev reset link: <a href={resetUrl} className="underline">{resetUrl}</a>
          </p>
        )}

        <div className="mt-4 text-sm">
          <Link href="/signin" className="text-blue-600 hover:text-blue-800">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
