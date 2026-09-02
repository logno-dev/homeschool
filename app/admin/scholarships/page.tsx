'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '../../components/AdminLayout'
import Button from '@/app/components/Button'
import { useToast } from '@/app/components/ToastContainer'

interface ScholarshipApplicationData {
  id: string
  applicationId?: string
  familyId: string
  familyName: string | null
  sessionId: string
  sessionName: string | null
  guardianFirstName: string | null
  guardianLastName: string | null
  scholarshipType: string
  requestedAmount: number | null
  approvedAmount: number | null
  reason: string
  additionalInfo: string | null
  status: string
  reviewNotes: string | null
  createdAt: string
  remainingAmount: number
  eligibleAmount: number
}

interface ScholarshipTransaction {
  id: string
  amount: number
  transactionType: string
  source: string
  notes: string | null
  createdAt: string
  familyName: string | null
  createdByFirstName: string | null
  createdByLastName: string | null
}

export default function ScholarshipsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [applications, setApplications] = useState<ScholarshipApplicationData[]>([])
  const [transactions, setTransactions] = useState<ScholarshipTransaction[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [donationAmount, setDonationAmount] = useState('')
  const [donationNotes, setDonationNotes] = useState('')
  const [submittingDonation, setSubmittingDonation] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/signin')
      return
    }

    fetchScholarshipData()
  }, [authLoading, user, router])

  const fetchScholarshipData = async () => {
    try {
      setLoading(true)
      const [fundResponse, applicationsResponse] = await Promise.all([
        fetch('/api/admin/scholarship-fund'),
        fetch('/api/admin/scholarship-applications')
      ])

      if (!fundResponse.ok || !applicationsResponse.ok) {
        throw new Error('Failed to load scholarship data')
      }

      const fundData = await fundResponse.json()
      const applicationData = await applicationsResponse.json()

      setBalance(fundData.balance || 0)
      setTransactions(fundData.transactions || [])
      const loadedApplications = (applicationData.applications || []).map((application: ScholarshipApplicationData) => ({
        ...application,
        id: application.id || application.applicationId || ''
      }))
      setApplications(loadedApplications)
      if (loadedApplications.some((application: ScholarshipApplicationData) => !application.id)) {
        setError('Some scholarship applications are missing ids. Please refresh or contact support.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scholarship data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)

  const formatDate = (value: string) => new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const pendingCount = useMemo(
    () => applications.filter((application) => application.status === 'pending').length,
    [applications]
  )

  const handleDonationSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!donationAmount || Number(donationAmount) <= 0) {
      setError('Please enter a valid cash donation amount.')
      return
    }

    setSubmittingDonation(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/scholarship-fund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Number(donationAmount),
          notes: donationNotes
        })
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to record donation')
      }

      setDonationAmount('')
      setDonationNotes('')
      await fetchScholarshipData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record donation')
    } finally {
      setSubmittingDonation(false)
    }
  }

  const handleApplicationAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (!id || !id.trim()) {
        throw new Error('Missing scholarship application id.')
      }
      setError(null)
      setActionInProgress(id)
      const trimmedId = id.trim()
      const response = await fetch(`/api/admin/scholarship-applications/${encodeURIComponent(trimmedId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          reviewNotes: reviewNotes[id],
          applicationId: trimmedId
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update application')
      }

      await fetchScholarshipData()
      showSuccess('Scholarship updated', action === 'approve' ? 'Application approved.' : 'Application rejected.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update application'
      setError(message)
      showError('Action failed', message)
    } finally {
      setActionInProgress(null)
    }
  }

  if (loading) {
    return (
      <AdminLayout userName={user?.firstName || 'Admin'} activeTab="scholarships">
        <div className="p-6">Loading scholarship data...</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout userName={user?.firstName || 'Admin'} activeTab="scholarships">
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Scholarship Fund</h1>
          <p className="text-gray-600">Track fund balance, review requests, and record donations.</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">Fund Balance</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(balance)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">Pending Requests</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{pendingCount}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
            <div className="text-sm text-indigo-700 font-medium">Quick Tip</div>
            <div className="text-sm text-indigo-700 mt-2">Record cash donations here to keep the balance accurate.</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Cash Donation</h2>
          <form onSubmit={handleDonationSubmit} className="grid gap-4 md:grid-cols-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={donationAmount}
                  onChange={(event) => setDonationAmount(event.target.value)}
                  className="pl-7 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <input
                type="text"
                value={donationNotes}
                onChange={(event) => setDonationNotes(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional source or memo"
              />
            </div>
            <Button type="submit" variant="primary" disabled={submittingDonation}>
              {submittingDonation ? 'Saving...' : 'Record Donation'}
            </Button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scholarship Requests</h2>
          {applications.length === 0 ? (
            <div className="text-sm text-gray-500">No scholarship requests submitted yet.</div>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <div key={application.id || application.applicationId} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {application.familyName || 'Unknown Family'} • {application.sessionName || 'Session'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested by {application.guardianFirstName} {application.guardianLastName}
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {application.status.toUpperCase()}
                    </span>
                  </div>
                  {!application.id && !application.applicationId && (
                    <div className="mt-3 text-sm text-red-600">
                      Missing application id. Please refresh the page.
                    </div>
                  )}
                  {application.id && (
                    <div className="mt-2 text-xs text-gray-400">Application ID: {application.id}</div>
                  )}
                  <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    <div>Type: {application.scholarshipType}</div>
                    <div>Requested: {formatCurrency(application.requestedAmount || 0)}</div>
                    <div>Outstanding: {formatCurrency(application.remainingAmount)}</div>
                    <div>Eligible (80% of registration fee): {formatCurrency(application.eligibleAmount)}</div>
                    {application.approvedAmount !== null && (
                      <div>Approved: {formatCurrency(application.approvedAmount)}</div>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-gray-600">Reason: {application.reason}</div>
                  {application.additionalInfo && (
                    <div className="mt-2 text-xs text-gray-500">Additional: {application.additionalInfo}</div>
                  )}
                  <div className="mt-3 text-xs text-gray-500">Submitted {formatDate(application.createdAt)}</div>

                  {application.status === 'pending' && (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={reviewNotes[application.id] || ''}
                        onChange={(event) => setReviewNotes((prev) => ({ ...prev, [application.id]: event.target.value }))}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add review notes (optional)"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          type="button"
                          onClick={() => handleApplicationAction((application.id || application.applicationId || '').trim(), 'approve')}
                          disabled={actionInProgress === (application.id || application.applicationId)}
                        >
                          {actionInProgress === (application.id || application.applicationId) ? 'Processing...' : 'Approve'}
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => handleApplicationAction((application.id || application.applicationId || '').trim(), 'reject')}
                          disabled={actionInProgress === (application.id || application.applicationId)}
                        >
                          {actionInProgress === (application.id || application.applicationId) ? 'Processing...' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fund Transactions</h2>
          {transactions.length === 0 ? (
            <div className="text-sm text-gray-500">No transactions logged yet.</div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {transaction.transactionType} • {transaction.source}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(transaction.createdAt)}
                      {transaction.familyName ? ` • ${transaction.familyName}` : ''}
                      {transaction.createdByFirstName ? ` • ${transaction.createdByFirstName} ${transaction.createdByLastName}` : ''}
                    </div>
                    {transaction.notes && (
                      <div className="text-xs text-gray-500">{transaction.notes}</div>
                    )}
                  </div>
                  <div className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
