'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import UserManagementTable from '@/app/components/UserManagementTable'
import { useToast } from '@/app/components/ToastContainer'

interface EnrolledSession {
  id: string
  name: string
}

interface WorkosUser {
  id: string
  userId?: string
  email: string
  firstName: string
  lastName: string
  role: string
  status?: string
  enrolledSessions?: EnrolledSession[]
  paymentStatus?: string
  paymentTotalOutstanding?: number
}

interface PendingActivation {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface SessionOption {
  id: string
  name: string
}

interface UserFilters {
  search: string
  role: string
  status: string
  sessionId: string
  paymentStatus: string
}

const DEFAULT_FILTERS: UserFilters = {
  search: '',
  role: 'all',
  status: 'all',
  sessionId: 'all',
  paymentStatus: 'all'
}

const roleLabelMap: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  user: 'User',
  'org-admin': 'Admin',
  'org-staff': 'Moderator',
  'org-user': 'User',
  all: 'All'
}

const paymentStatusLabelMap: Record<string, string> = {
  paid: 'Paid',
  outstanding: 'Outstanding',
  delinquent: 'Delinquent',
  no_fees: 'No Fees',
  all: 'All'
}

export default function AdminUsersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useToast()

  const [users, setUsers] = useState<WorkosUser[]>([])
  const [pendingActivations, setPendingActivations] = useState<PendingActivation[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS)
  const [formFilters, setFormFilters] = useState<UserFilters>(DEFAULT_FILTERS)

  const buildParams = (page: number, activeFilters: UserFilters) => {
    const query = new URLSearchParams({
      page: String(page),
      limit: '20'
    })

    if (activeFilters.search.trim()) query.set('search', activeFilters.search.trim())
    if (activeFilters.role !== 'all') query.set('role', activeFilters.role)
    if (activeFilters.status !== 'all') query.set('status', activeFilters.status)
    if (activeFilters.sessionId !== 'all') query.set('sessionId', activeFilters.sessionId)
    if (activeFilters.paymentStatus !== 'all') query.set('paymentStatus', activeFilters.paymentStatus)

    return query
  }

  const formatSessions = (sessionList: EnrolledSession[] = []) => {
    if (!sessionList.length) {
      return 'None'
    }

    return sessionList.map((session) => session.name).join(', ')
  }

  const fetchUsers = async (page: number = 1, activeFilters: UserFilters = filters) => {
    try {
      setIsLoading(true)
      const query = buildParams(page, activeFilters)
      const response = await fetch(`/api/admin/users?${query.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setPendingActivations(data.pendingActivations || [])
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

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions')
      if (!response.ok) {
        return
      }

      const data = await response.json()
      const sortedSessions = (data.sessions || []) as SessionOption[]
      sortedSessions.sort((a, b) => a.name.localeCompare(b.name))
      setSessions(sortedSessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  const updateFilterForm = (field: keyof UserFilters, value: string) => {
    setFormFilters((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const applyFilters = async (event?: FormEvent) => {
    if (event) {
      event.preventDefault()
    }

    setFilters(formFilters)
    await fetchUsers(1, formFilters)
  }

  const resetFilters = async () => {
    setFormFilters(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    await fetchUsers(1, DEFAULT_FILTERS)
  }

  const sanitizeCsvCell = (value: unknown) => {
    const text = String(value ?? '').replace(/"/g, '""')
    return `"${text}"`
  }

  const exportCsv = async () => {
    try {
      setIsExporting(true)
      const query = buildParams(1, filters)
      query.set('export', 'true')
      const response = await fetch(`/api/admin/users?${query.toString()}`)
      if (!response.ok) {
        const payload = await response.json()
        const message = payload.error || 'Failed to export users'
        setLoadError(message)
        showError('Export failed', message)
        return
      }

      const data = await response.json()
      const rows = (data.users || []) as WorkosUser[]

      const headers = ['Name', 'Email', 'Role', 'Account Status', 'Enrolled Sessions', 'Payment Status', 'Outstanding']
      const bodyRows = rows.map((row) => [
        sanitizeCsvCell(`${row.firstName} ${row.lastName}`),
        sanitizeCsvCell(row.email),
        sanitizeCsvCell(roleLabelMap[row.role] || row.role || ''),
        sanitizeCsvCell(row.status === 'inactive' ? 'Inactive' : 'Active'),
        sanitizeCsvCell(formatSessions(row.enrolledSessions || [])),
        sanitizeCsvCell(paymentStatusLabelMap[row.paymentStatus || 'no_fees']),
        sanitizeCsvCell(Number(row.paymentTotalOutstanding || 0).toFixed(2))
      ])

      const csv = [headers.join(','), ...bodyRows.map((cells) => cells.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting users:', error)
      showError('Export failed', 'Failed to export users')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      router.push('/signin')
      return
    }

    Promise.all([fetchUsers(1), fetchSessions()])
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
    <AdminLayout userName={userName || 'Admin'} activeTab="users">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {loadError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
          )}

          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h1 className="text-xl font-semibold text-gray-900">User management</h1>
              <button
                type="button"
                onClick={exportCsv}
                disabled={isExporting}
                className="inline-flex justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? 'Exporting…' : 'Export Filtered Users'}
              </button>
            </div>

            <form className="grid gap-3 md:grid-cols-5" onSubmit={applyFilters}>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={formFilters.search}
                  onChange={(event) => updateFilterForm('search', event.target.value)}
                  placeholder="Name or email"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
                <select
                  value={formFilters.role}
                  onChange={(event) => updateFilterForm('role', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All Roles</option>
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
                <select
                  value={formFilters.status}
                  onChange={(event) => updateFilterForm('status', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrolled Session</label>
                <select
                  value={formFilters.sessionId}
                  onChange={(event) => updateFilterForm('sessionId', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All Sessions</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                <select
                  value={formFilters.paymentStatus}
                  onChange={(event) => updateFilterForm('paymentStatus', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="outstanding">Outstanding</option>
                  <option value="delinquent">Delinquent</option>
                  <option value="no_fees">No Fees</option>
                </select>
              </div>

              <div className="md:col-span-5 flex items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          <UserManagementTable
            initialUsers={users}
            pendingActivations={pendingActivations}
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
