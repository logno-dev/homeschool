'use client'

import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUserSession } from '@/lib/user-session'
import ClassTeachingRequests from '@/app/components/ClassTeachingRequests'
import TeacherScheduleReview from '@/app/components/TeacherScheduleReview'

export default function TeacherDashboard() {
  const { user, loading } = useAuth()
  const { loading: userLoading, isTeacher } = useUserSession()
  const router = useRouter()
  const [requestsVisible, setRequestsVisible] = useState<boolean | null>(null)
  const [teachingVisible, setTeachingVisible] = useState<boolean | null>(null)

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

  const dashboardIsEmpty = requestsVisible === false && (!isTeacher || teachingVisible === false)

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="space-y-10 px-4 py-6 sm:px-0">
          <ClassTeachingRequests openOnly onVisibilityChange={setRequestsVisible} />
          {isTeacher && <TeacherScheduleReview onVisibilityChange={setTeachingVisible} />}
          {dashboardIsEmpty && <section className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-10 text-center shadow-sm"><h1 className="text-xl font-semibold text-blue-950">No teaching actions right now</h1><p className="mx-auto mt-2 max-w-xl text-blue-800">Come back to submit a teaching request for the next session! Once a schedule is ready, your classes and rosters will appear here.</p></section>}
        </div>
      </main>
    </div>
  )
}
