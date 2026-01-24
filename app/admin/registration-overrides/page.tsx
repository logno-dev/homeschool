'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import RegistrationOverrideManagement from '@/app/components/RegistrationOverrideManagement'

interface Session {
  id: string
  name: string
  startDate: string
  endDate: string
  registrationStartDate: string
  registrationEndDate: string
  isActive: boolean
}

export default function RegistrationOverridesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/signin')
      return
    }

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    setUserName(displayName)

    // Fetch active session and user info
    const fetchData = async () => {
      try {
        const sessionsResponse = await fetch('/api/admin/sessions')

        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json()
          const activeSess = sessionsData.sessions?.find((s: Session) => s.isActive)
          setActiveSession(activeSess || null)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, loading, router])

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!activeSession) {
    return (
      <AdminLayout userName={userName || 'Admin'} activeTab="registration-overrides">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">No Active Session</h2>
              <p className="mt-2 text-gray-600">
                There is no active session. Please activate a session to manage registration overrides.
              </p>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout userName={userName || 'Admin'} activeTab="registration-overrides">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Registration Override Management</h1>
            <p className="mt-2 text-gray-600">
              Review and approve or deny registration override requests for families who haven't met volunteer requirements.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Active Session: <strong>{activeSession.name}</strong>
            </p>
          </div>
          
          <RegistrationOverrideManagement sessionId={activeSession.id} />
        </div>
      </div>
    </AdminLayout>
  )
}
