"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface EnrolledSession {
  id: string
  name: string
  startDate?: string | null
  endDate?: string | null
}

interface LatestSession {
  id: string
  name: string
  endDate?: string | null
}

interface User {
  id: string
  userId?: string
  email: string
  firstName: string
  lastName: string
  role: string
  status?: string
  enrolledSessions?: EnrolledSession[]
  latestSession?: LatestSession | null
  paymentStatus?: string
  paymentTotalOutstanding?: number
}

interface PendingActivation {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
  status: string
  contactInfoRelease?: string | null
  photographyRelease?: string | null
  handbookVersion?: string | null
  acknowledgedAt?: string | null
  family?: { name: string; address: string; phone: string; email: string; sharingCode: string } | null
  children?: Array<{ firstName: string; lastName: string; dateOfBirth: string; grade: string }>
}

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface UserManagementTableProps {
  initialUsers: User[]
  pendingActivations: PendingActivation[]
  currentUserId: string
  pagination?: PaginationInfo | null
  currentPage?: number
  onPageChange?: (page: number) => void
  isLoading?: boolean
}

const paymentStatusConfig: Record<string, { label: string; classes: string }> = {
  paid: { label: 'Paid', classes: 'bg-green-100 text-green-800' },
  outstanding: { label: 'Outstanding', classes: 'bg-amber-100 text-amber-800' },
  delinquent: { label: 'Delinquent', classes: 'bg-red-100 text-red-800' },
  no_fees: { label: 'No Fees', classes: 'bg-gray-100 text-gray-700' }
}

export default function UserManagementTable({
  initialUsers,
  pendingActivations,
  currentUserId,
  pagination,
  currentPage = 1,
  onPageChange,
  isLoading = false
}: UserManagementTableProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [pending, setPending] = useState(pendingActivations)
  const [reviewApplicant, setReviewApplicant] = useState<PendingActivation | null>(null)

  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  useEffect(() => {
    setPending(pendingActivations)
  }, [pendingActivations])

  const approveUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to approve user')
      }
      setPending((current) => current.filter((user) => user.id !== userId))
      setMessage('User approved successfully')
      setMessageType('success')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to approve user')
      setMessageType('error')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const rejectUser = async (userId: string) => {
    if (!confirm('Reject this account? The user will not be able to sign in.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/reject`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to reject user')
      }
      setPending((current) => current.filter((user) => user.id !== userId))
      setReviewApplicant(null)
      setMessage('User rejected')
      setMessageType('success')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to reject user')
      setMessageType('error')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const reviewUser = async (applicant: PendingActivation) => {
    try {
      if (applicant.status !== 'under_review') {
        const response = await fetch(`/api/admin/users/${applicant.id}/review`, { method: 'POST' })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to review user')
        }
        const updatedApplicant = { ...applicant, status: 'under_review' }
        setPending((current) => current.map((user) => user.id === applicant.id ? updatedApplicant : user))
        setReviewApplicant(updatedApplicant)
      } else {
        setReviewApplicant(applicant)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to review user')
      setMessageType('error')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'org-admin':
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'org-staff':
      case 'staff':
      case 'moderator':
        return 'bg-blue-100 text-blue-800'
      case 'org-user':
      case 'user':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'org-admin':
      case 'admin':
        return 'Admin'
      case 'org-staff':
      case 'staff':
      case 'moderator':
        return 'Moderator'
      case 'org-user':
      case 'user':
        return 'User'
      default:
        return role
    }
  }

  const getLatestSessionText = (sessionList: EnrolledSession[] = [], latestSession?: LatestSession | null) => {
    if (latestSession?.name) {
      return latestSession.name
    }

    if (!sessionList.length) {
      return 'None'
    }

    const sortedSessions = [...sessionList].sort((a, b) => {
      if (!a.endDate && !b.endDate) {
        return 0
      }
      if (!a.endDate) {
        return 1
      }
      if (!b.endDate) {
        return -1
      }
      return b.endDate.localeCompare(a.endDate)
    })

    return sortedSessions[0]?.name || 'None'
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-1">Pending activations</h2>
            <p className="text-sm text-gray-600 mb-4">Review new accounts before allowing them to sign in.</p>
            <div className="overflow-x-auto rounded-lg border border-amber-200">
              <table className="min-w-full divide-y divide-amber-200">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pending.map((applicant) => (
                    <tr key={applicant.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{applicant.firstName} {applicant.lastName}</div>
                        <div className="text-sm text-gray-600">{applicant.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(applicant.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${applicant.status === 'under_review' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                          {applicant.status === 'under_review' ? 'Under review' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => reviewUser(applicant)} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Review</button>
                          <button onClick={() => approveUser(applicant.id)} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">Approve</button>
                          <button onClick={() => rejectUser(applicant.id)} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reviewApplicant && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-blue-900">Review applicant</h3>
                    <p className="mt-1 text-sm text-blue-900">{reviewApplicant.firstName} {reviewApplicant.lastName} · {reviewApplicant.email}</p>
                  </div>
                  <button onClick={() => setReviewApplicant(null)} className="text-sm text-blue-700 hover:text-blue-900">Close</button>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="font-medium text-blue-900">Registered</dt><dd className="text-blue-800">{new Date(reviewApplicant.createdAt).toLocaleString()}</dd></div>
                  <div><dt className="font-medium text-blue-900">Status</dt><dd className="text-blue-800">{reviewApplicant.status === 'under_review' ? 'Under review' : 'Pending activation'}</dd></div>
                  <div><dt className="font-medium text-blue-900">Contact information release</dt><dd className="text-blue-800">{reviewApplicant.contactInfoRelease === 'agree' ? 'Agreed' : reviewApplicant.contactInfoRelease === 'do_not_agree' ? 'Did not agree' : 'Not recorded'}</dd></div>
                  <div><dt className="font-medium text-blue-900">Photography release</dt><dd className="text-blue-800">{reviewApplicant.photographyRelease === 'agree' ? 'Agreed' : reviewApplicant.photographyRelease === 'do_not_agree' ? 'Did not agree' : 'Not recorded'}</dd></div>
                  <div><dt className="font-medium text-blue-900">Handbook version</dt><dd className="text-blue-800">{reviewApplicant.handbookVersion || 'Not recorded'}</dd></div>
                  <div><dt className="font-medium text-blue-900">Acknowledged</dt><dd className="text-blue-800">{reviewApplicant.acknowledgedAt ? new Date(reviewApplicant.acknowledgedAt).toLocaleString() : 'Not recorded'}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-medium text-blue-900">Family</dt><dd className="text-blue-800">{reviewApplicant.family ? <>{reviewApplicant.family.name}<br />{reviewApplicant.family.address}<br />{reviewApplicant.family.phone} · {reviewApplicant.family.email}<br /><span className="text-xs">Sharing code: {reviewApplicant.family.sharingCode}</span></> : 'Not provided'}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-medium text-blue-900">Children</dt><dd className="text-blue-800">{reviewApplicant.children?.length ? reviewApplicant.children.map((child) => <div key={`${child.firstName}-${child.lastName}`}>{child.firstName} {child.lastName} · Grade {child.grade} · DOB {child.dateOfBirth}</div>) : 'None listed'}</dd></div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => approveUser(reviewApplicant.id)} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">Approve</button>
                  <button onClick={() => rejectUser(reviewApplicant.id)} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">Reject</button>
                </div>
              </div>
            )}
          </section>
        )}
        <h2 className="text-lg font-medium text-gray-900 mb-1">User Management</h2>
        <p className="text-sm text-gray-600 mb-6">View accounts and open a user to manage their access, groups, and account status.</p>

        {message && (
          <div className={`mb-4 p-4 rounded-md ${
            messageType === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Session</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => {
                const paymentStatus = paymentStatusConfig[user.paymentStatus || 'no_fees'] || paymentStatusConfig.no_fees
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                        {user.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-xs truncate">{getLatestSessionText(user.enrolledSessions, user.latestSession)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${paymentStatus.classes}`}>
                          {paymentStatus.label}
                        </span>
                        <div className="text-xs text-gray-500">Outstanding ${Number(user.paymentTotalOutstanding || 0).toFixed(2)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/admin/users/${user.id}`} className="text-blue-600 hover:text-blue-900">Manage</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {users.map((user) => {
            const paymentStatus = paymentStatusConfig[user.paymentStatus || 'no_fees'] || paymentStatusConfig.no_fees
            return (
              <div key={user.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</h3>
                      <p className="text-sm text-gray-600 truncate">{user.email}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                      {user.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </div>

                  <div className="text-sm">
                    <p className="text-gray-500">Role: <span className={`ml-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>{getRoleLabel(user.role)}</span></p>
                    <p className="text-gray-500 mt-1">Latest Session: {getLatestSessionText(user.enrolledSessions, user.latestSession)}</p>
                    <p className="text-gray-500 mt-1">
                      Payment: <span className={`ml-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${paymentStatus.classes}`}>{paymentStatus.label}</span>
                    </p>
                    <p className="text-gray-500 mt-1">Outstanding: ${Number(user.paymentTotalOutstanding || 0).toFixed(2)}</p>
                  </div>

                  <Link href={`/admin/users/${user.id}`} className="block w-full rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-100">Manage User</Link>
                </div>
              </div>
            )
          })}
        </div>

        {users.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">No users found</div>
        )}

        {isLoading && (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2">Loading users...</p>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => onPageChange && onPageChange(currentPage - 1)}
                disabled={!pagination.hasPrev || isLoading}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange && onPageChange(currentPage + 1)}
                disabled={!pagination.hasNext || isLoading}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{((currentPage - 1) * pagination.limit) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * pagination.limit, pagination.totalCount)}</span> of{' '}
                <span className="font-medium">{pagination.totalCount}</span> results
              </p>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => onPageChange && onPageChange(currentPage - 1)}
                  disabled={!pagination.hasPrev || isLoading}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange && onPageChange(pageNum)}
                      disabled={isLoading}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === currentPage
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => onPageChange && onPageChange(currentPage + 1)}
                  disabled={!pagination.hasNext || isLoading}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
