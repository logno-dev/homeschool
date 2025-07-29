'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AdminLayout from '@/app/components/AdminLayout'
import ScheduleGrid from '@/app/components/ScheduleGrid'
import type { Session } from '@/lib/schema'

export default function AdminSchedulePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const [sessionData, setSessionData] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/signin')
      return
    }

    // Fetch session data to display session name
    const fetchSessionData = async () => {
      try {
        const response = await fetch(`/api/admin/sessions/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setSessionData(data.session)
        }
      } catch (error) {
        console.error('Error fetching session data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (sessionId) {
      fetchSessionData()
    }
  }, [session, status, router, sessionId])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <AdminLayout 
      userName={session.user.name || 'Admin'} 
      activeTab="sessions"
    >
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/admin/sessions"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Back to Sessions
            </Link>
            {sessionData && (
              <h1 className="mt-2 text-2xl font-bold text-gray-900">
                Schedule for {sessionData.name}
              </h1>
            )}
          </div>
          
          <ScheduleGrid sessionId={sessionId} />
        </div>
      </main>
    </AdminLayout>
  )
}