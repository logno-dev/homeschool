'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function FamilyJoinPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [sharingCode, setSharingCode] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin')
      return
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/family/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sharingCode: sharingCode.toUpperCase(),
          phone
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`Successfully joined ${data.familyName}!`)
        setMessageType('success')
        setTimeout(() => {
          router.push('/family/profile')
        }, 2000)
      } else {
        setMessage(data.error || 'Failed to join family')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error joining family:', error)
      setMessage('Error joining family')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Join a Family
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto py-12 px-4">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Your Family</h2>
            <p className="text-gray-600">
              Enter the sharing code provided by the main family contact to join their family profile.
            </p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              messageType === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Family Sharing Code
              </label>
              <input
                type="text"
                value={sharingCode}
                onChange={(e) => setSharingCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono text-gray-900 bg-white"
                placeholder="ABC123"
                maxLength={6}
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                This is a 6-character code provided by your family's main contact.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="(555) 123-4567"
              />
              <p className="text-sm text-gray-500 mt-1">
                Optional: Your contact phone number for the family profile.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !sharingCode}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-md font-medium"
            >
              {loading ? 'Joining...' : 'Join Family'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have a sharing code?{' '}
              <button
                onClick={() => router.push('/family/register')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Register a new family
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}