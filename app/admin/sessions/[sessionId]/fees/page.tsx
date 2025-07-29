'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AdminLayout from '@/app/components/AdminLayout'
import SessionFeeConfig from '@/app/components/SessionFeeConfig'
import type { Session } from '@/lib/schema'

export default function AdminSessionFeesPage() {
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

  if (!session || !sessionData) {
    return null
  }

  return (
    <AdminLayout 
      userName={session.user.name || 'Admin'} 
      activeTab="sessions"
    >
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Breadcrumb */}
          <nav className="flex mb-6" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link 
                  href="/admin/sessions" 
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  Sessions
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                    {sessionData.name}
                  </span>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                    Fee Configuration
                  </span>
                </div>
              </li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Fee Configuration</h1>
            <p className="mt-2 text-sm text-gray-600">
              Configure registration fees and due dates for {sessionData.name}
            </p>
          </div>

          {/* Fee Configuration Component */}
          <SessionFeeConfig 
            sessionId={sessionId} 
            sessionName={sessionData.name} 
          />
        </div>
      </main>
    </AdminLayout>
  )
}