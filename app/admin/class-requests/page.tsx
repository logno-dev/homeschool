'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import ClassTeachingRequestReview from '@/app/components/ClassTeachingRequestReview'
import AdminClassCreateForm from '@/app/components/AdminClassCreateForm'
import type { ClassTeachingRequest, Session } from '@/lib/schema'

export default function AdminClassRequestsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [classRequests, setClassRequests] = useState<(ClassTeachingRequest & { session: Session; teacherDisplayName?: string })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [teachers, setTeachers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string }>>([])

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/signin')
      return
    }

    // Fetch class requests data
    const fetchClassRequests = async () => {
      try {
        const response = await fetch('/api/admin/class-teaching-requests')
        if (response.ok) {
          const data = await response.json()
           setClassRequests(data.requests || [])
           setSessions(data.sessions || [])
           setTeachers(data.teachers || [])
        }
      } catch (error) {
        console.error('Error fetching class requests:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchClassRequests()
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
      activeTab="class-requests"
    >
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="space-y-6">
            <AdminClassCreateForm sessions={sessions} teachers={teachers} onCreated={() => window.location.reload()} />
            <ClassTeachingRequestReview initialRequests={classRequests} teachers={teachers} />
          </div>
        </div>
      </main>
    </AdminLayout>
  )
}
