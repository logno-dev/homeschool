'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Button from '@/app/components/Button'

interface Session {
  id: string
  name: string
  isActive: boolean
}

export default function RegistrationPage() {
  const router = useRouter()
  const [activeSessions, setActiveSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchActiveSessions()
  }, [])

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/sessions/active')
      if (response.ok) {
        const data = await response.json()
        const active = data.sessions?.filter((session: Session) => session.isActive) || []
        setActiveSessions(active)
      }
    } catch (error) {
      console.error('Error fetching active sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Class Registration</h1>
            <p className="text-gray-600 mb-8">
              Select a session below to register your children for classes.
            </p>

            {isLoading ? (
              <div className="space-y-4">
                <div className="h-20 bg-gray-200 animate-pulse rounded-lg"></div>
                <div className="h-20 bg-gray-200 animate-pulse rounded-lg"></div>
              </div>
            ) : activeSessions.length > 0 ? (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="border border-gray-200 rounded-lg p-6 hover:border-orange-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {session.name}
                        </h3>
                        <p className="text-gray-600">
                          Registration is currently open for this session.
                        </p>
                      </div>
                      <Button
                        onClick={() => router.push(`/registration/${session.id}`)}
                        variant="primary"
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        Register Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Active Sessions
                </h3>
                <p className="text-gray-600 mb-6">
                  There are currently no active sessions available for registration. 
                  Please check back later or contact the administrator.
                </p>
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="outline"
                >
                  Back to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}