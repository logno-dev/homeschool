'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import { VolunteerJobsManagement } from '@/app/components/VolunteerJobsManagement'

interface Session {
  id: string
  name: string
  isActive: boolean
}

export default function VolunteerJobsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/signin')
      return
    }
    fetchSessions()
  }, [session, status, router])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
        
        // Auto-select the active session if available
        const activeSession = data.sessions?.find((s: Session) => s.isActive)
        if (activeSession) {
          setSelectedSessionId(activeSession.id)
        } else if (data.sessions?.length > 0) {
          setSelectedSessionId(data.sessions[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (!session) {
    return null
  }

  return (
    <AdminLayout 
      userName={session.user?.name || session.user?.email || 'User'} 
      activeTab="volunteer-jobs"
    >
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Volunteer Jobs Management</h1>
        
          {sessions.length > 0 && (
            <div className="mb-6">
              <label htmlFor="session-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Session
              </label>
              <select
                id="session-select"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a session...</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} {session.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedSessionId ? (
          <VolunteerJobsManagement sessionId={selectedSessionId} />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Please select a session to manage volunteer jobs.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}