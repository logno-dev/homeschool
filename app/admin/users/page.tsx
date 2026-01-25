'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import UserManagementTable from '@/app/components/UserManagementTable'
import { useToast } from '@/app/components/ToastContainer'
interface WorkosUser {
  id: string
  userId?: string
  email: string
  firstName: string
  lastName: string
  role: string
  status?: string
}

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export default function AdminUsersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useToast()
  const [users, setUsers] = useState<WorkosUser[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Fetch users data
  const fetchUsers = async (page: number = 1) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/admin/users?page=${page}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setPagination(data.pagination)
        setCurrentPage(page)
        setLoadError(null)
      } else {
        const payload = await response.json()
        const message = payload.error || 'Failed to load users'
        setLoadError(message)
        showError('User load failed', message)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setLoadError('Failed to load users')
      showError('User load failed', 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/signin')
      return
    }

    fetchUsers(1)
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
      activeTab="users"
    >
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {loadError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {loadError}
            </div>
          )}
          <UserManagementTable 
            initialUsers={users} 
            currentUserId={user.id}
            pagination={pagination}
            currentPage={currentPage}
            onPageChange={fetchUsers}
            isLoading={isLoading}
          />
        </div>
      </main>
    </AdminLayout>
  )
}
