'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import SessionManagement from '@/app/components/SessionManagement'
import type { Session } from '@/lib/schema'

export default function AdminSessionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [groups, setGroups] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/signin')
      return
    }

    // Fetch sessions data
    const fetchSessions = async () => {
      try {
        const response = await fetch('/api/admin/sessions')
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
          const groupsResponse = await fetch('/api/admin/groups')
          if (groupsResponse.ok) {
            const groupsData = await groupsResponse.json()
            setGroups(groupsData.groups || [])
          }
        }
      } catch (error) {
        console.error('Error fetching sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSessions()
  }, [user, loading, router])

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  return (
    <AdminLayout 
      userName={userName || 'Admin'} 
      activeTab="sessions"
    >
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
           <SessionManagement initialSessions={sessions} groups={groups} />
        </div>
      </main>
    </AdminLayout>
  )
}
