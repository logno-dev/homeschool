'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import ClassroomManagement from '@/app/components/ClassroomManagement'
import type { Classroom } from '@/lib/schema'

export default function AdminClassroomsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/signin')
      return
    }

    // Fetch classrooms data
    const fetchClassrooms = async () => {
      try {
        const response = await fetch('/api/admin/classrooms')
        if (response.ok) {
          const data = await response.json()
          setClassrooms(data.classrooms || [])
        }
      } catch (error) {
        console.error('Error fetching classrooms:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchClassrooms()
  }, [session, status, router])

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
      activeTab="classrooms"
    >
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <ClassroomManagement initialClassrooms={classrooms} />
        </div>
      </main>
    </AdminLayout>
  )
}