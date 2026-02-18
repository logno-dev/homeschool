'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import { VolunteerJobsManagement } from '@/app/components/VolunteerJobsManagement'

export default function VolunteerJobsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/signin')
      return
    }
    setLoading(false)
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  return (
    <AdminLayout 
      userName={userName || 'User'} 
      activeTab="volunteer-jobs"
    >
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Volunteer Jobs Management</h1>
        
          <p className="text-sm text-gray-600">
            Volunteer jobs are configured globally and copied into sessions when they are created or updated.
          </p>
        </div>

        <VolunteerJobsManagement />
      </div>
    </AdminLayout>
  )
}
