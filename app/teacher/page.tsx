'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUserSession } from '@/lib/user-session'
import ClassTeachingRequests from '@/app/components/ClassTeachingRequests'
import TeacherScheduleReview from '@/app/components/TeacherScheduleReview'

export default function TeacherDashboard() {
  const { data: session, status } = useSession()
  const { userData, loading: userLoading, isTeacher } = useUserSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'requests' | 'schedule'>('requests')

  useEffect(() => {
    if (status === 'loading' || userLoading) return

    if (!session) {
      router.push('/signin')
      return
    }
  }, [session, status, userLoading, router])

  if (status === 'loading' || userLoading) {
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
    <div className="min-h-screen bg-gray-50">

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Class Teaching Requests
            </button>
            {isTeacher && (
              <button
                onClick={() => setActiveTab('schedule')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'schedule'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Schedule Review
              </button>
            )}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {activeTab === 'requests' && <ClassTeachingRequests />}
          {activeTab === 'schedule' && isTeacher && <TeacherScheduleReview />}
        </div>
      </main>
    </div>
  )
}