'use client'

import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useUserSession } from '@/lib/user-session'
import ClassTeachingRequests from '@/app/components/ClassTeachingRequests'
import TeacherScheduleReview from '@/app/components/TeacherScheduleReview'

export default function TeacherDashboard() {
  const { user, loading } = useAuth()
  const { loading: userLoading, isTeacher } = useUserSession()
  const router = useRouter()

  useEffect(() => {
    if (loading || userLoading) return

    if (!user) {
      router.push('/signin')
      return
    }
  }, [user, loading, userLoading, router])

  if (loading || userLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="space-y-10 px-4 py-6 sm:px-0">
          <ClassTeachingRequests openOnly />
          {isTeacher && <TeacherScheduleReview />}
        </div>
      </main>
    </div>
  )
}
