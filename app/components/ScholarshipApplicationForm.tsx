'use client'

import { useEffect, useMemo, useState } from 'react'
import Button from './Button'

interface FeeData {
  id: string
  sessionId: string
  sessionName: string
  totalFee: number
  registrationFee: number
  paidAmount: number
  remainingAmount: number
  dueDate: string
}

interface ScholarshipApplication {
  id: string
  sessionId: string
  sessionName: string | null
  scholarshipType: string
  requestedAmount: number | null
  approvedAmount: number | null
  status: string
  reviewNotes: string | null
  createdAt: string
}

export default function ScholarshipApplicationForm() {
  const [fees, setFees] = useState<FeeData[]>([])
  const [applications, setApplications] = useState<ScholarshipApplication[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [amountMode, setAmountMode] = useState<'percentage' | 'dollar'>('percentage')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [reason, setReason] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [feesResponse, applicationsResponse] = await Promise.all([
          fetch('/api/family/fees'),
          fetch('/api/family/scholarship-applications')
        ])

        if (feesResponse.ok) {
          const feeData = await feesResponse.json()
          const outstandingFees = (feeData.fees || []).filter((fee: FeeData) => fee.remainingAmount > 0)
          setFees(outstandingFees)
          if (outstandingFees.length > 0) {
            setSelectedSessionId(outstandingFees[0].sessionId)
          }
        }

        if (applicationsResponse.ok) {
          const applicationData = await applicationsResponse.json()
          setApplications(applicationData.applications || [])
        }
      } catch (err) {
        console.error('Error loading scholarship data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const selectedFee = useMemo(
    () => fees.find((fee) => fee.sessionId === selectedSessionId) || null,
    [fees, selectedSessionId]
  )

  const existingApplication = useMemo(
    () => applications.find((application) => application.sessionId === selectedSessionId) || null,
    [applications, selectedSessionId]
  )
  const submissionLocked = existingApplication
    ? ['pending', 'approved'].includes(existingApplication.status)
    : false

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!selectedSessionId) {
      setError('Please select a session to request assistance.')
      return
    }

    if (!reason.trim()) {
      setError('Please share the reason for your request.')
      return
    }

    const amount = Number(requestedAmount)
    const maximumAmount = selectedFee ? Math.round(selectedFee.registrationFee * 0.8 * 100) / 100 : 0
    const requestedScholarshipAmount = amountMode === 'percentage'
      ? Math.round(maximumAmount * amount / 80 * 100) / 100
      : amount

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a scholarship amount greater than $0.')
      return
    }

    if (amountMode === 'percentage' && amount > 80) {
      setError('Scholarship percentage cannot exceed 80%.')
      return
    }

    if (requestedScholarshipAmount > maximumAmount) {
      setError(`The maximum scholarship for this session is ${formatCurrency(maximumAmount)}.`)
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/family/scholarship-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          scholarshipType: 'partial',
          requestedAmount: requestedScholarshipAmount,
          reason,
          additionalInfo
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit application')
      }

      setSuccessMessage('Scholarship request submitted. We will follow up with you soon.')
      setReason('')
      setAdditionalInfo('')
      setRequestedAmount('')

      const applicationsResponse = await fetch('/api/family/scholarship-applications')
      if (applicationsResponse.ok) {
        const applicationData = await applicationsResponse.json()
        setApplications(applicationData.applications || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading scholarship details...</div>
  }

  if (fees.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        No outstanding session fees were found. If you believe this is an error, contact the office.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p>It is our desire to help our children discover the many hidden treasures within themselves and also in their peers by lovingly providing a creative learning environment where they can have abundant opportunities to enjoy personal as well as public success. We understand the struggles families sometimes face, and as a co-op, we are here to help one another.</p>
        <p className="mt-3">Scholarship money is available to cover a portion of your family registration fees. The more you are able to contribute, the further our scholarship funds can go towards helping all our families.</p>
        <p className="mt-3">Please complete the following and the board members will determine the availability of funds. A new form will need to be completed each session that a scholarship is requested.</p>
      </div>

      {existingApplication && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-gray-900">Existing Request</div>
              <div className="text-xs text-gray-500">{existingApplication.sessionName || 'Session'}</div>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              {existingApplication.status.toUpperCase()}
            </span>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Requested {existingApplication.scholarshipType} scholarship for {formatCurrency(existingApplication.requestedAmount || 0)}.
          </div>
          {existingApplication.reviewNotes && (
            <div className="mt-2 text-sm text-gray-500 italic">
              Notes: {existingApplication.reviewNotes}
            </div>
          )}
        </div>
      )}

      {submissionLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          This request is still {existingApplication?.status}. You can submit a new request after it has been reviewed.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
          <select
            value={selectedSessionId}
            onChange={(event) => setSelectedSessionId(event.target.value)}
            disabled={submissionLocked}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {fees.map((fee) => (
              <option key={fee.sessionId} value={fee.sessionId}>
                {fee.sessionName} - {formatCurrency(fee.remainingAmount)} outstanding
              </option>
            ))}
          </select>
        </div>

        {selectedFee && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            Outstanding balance for {selectedFee.sessionName}: <span className="font-semibold">{formatCurrency(selectedFee.remainingAmount)}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Scholarship Amount</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
                <input
                  type="radio"
                  checked={amountMode === 'percentage'}
                  onChange={() => setAmountMode('percentage')}
                  disabled={submissionLocked}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                Percentage of registration fee
              </label>
              <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
                <input
                  type="radio"
                  checked={amountMode === 'dollar'}
                  onChange={() => setAmountMode('dollar')}
                  disabled={submissionLocked}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                Dollar amount
              </label>
          </div>
        </div>

        {selectedFee && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Requested {amountMode === 'percentage' ? 'Percentage' : 'Dollar Amount'}</label>
            <div className="relative">
              {amountMode === 'dollar' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>}
              <input
                type="number"
                min="1"
                max={amountMode === 'percentage' ? 80 : Math.round(selectedFee.registrationFee * 0.8 * 100) / 100}
                step={amountMode === 'percentage' ? 1 : 0.01}
                value={requestedAmount}
                onChange={(event) => setRequestedAmount(event.target.value)}
                disabled={submissionLocked}
                className={`${amountMode === 'dollar' ? 'pl-7' : 'pl-3'} w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="0"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Maximum: 80% of the registration fee ({formatCurrency(Math.round(selectedFee.registrationFee * 0.8 * 100) / 100)}). Class fees are not eligible.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Request</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            disabled={submissionLocked}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Share a brief summary of why you are requesting scholarship support."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Information (Optional)</label>
          <textarea
            value={additionalInfo}
            onChange={(event) => setAdditionalInfo(event.target.value)}
            rows={3}
            disabled={submissionLocked}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Household considerations, timing needs, or anything else you'd like us to know."
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={submitting || submissionLocked} className="w-full sm:w-auto">
          {submitting ? 'Submitting...' : 'Submit Scholarship Request'}
        </Button>
      </form>
    </div>
  )
}
