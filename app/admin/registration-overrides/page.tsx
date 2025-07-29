'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/signin')
      return
    }

    // Fetch active session and user info
    const fetchData = async () => {
      try {
        const [sessionsResponse, userResponse] = await Promise.all([
          fetch('/api/admin/sessions'),
          fetch('/api/admin/users')
        ])

        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json()
          const activeSess = sessionsData.sessions?.find((s: Session) => s.isActive)
          setActiveSession(activeSess || null)
        }

        if (userResponse.ok) {
          const userData = await userResponse.json()
          if (userData.users && userData.users.length > 0) {
            const currentUser = userData.users.find((u: any) => u.id === session.user?.id)
            if (currentUser) {
              setUserName(`${currentUser.firstName} ${currentUser.lastName}`)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [session, status, router])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
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