'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '../../components/AdminLayout'
import SessionOptions from '../../components/SessionOptions'

interface PaymentData {
  id: string
  familyName: string
  sessionName: string
  amount: number
  paymentDate: string
  paymentMethod: string
  notes?: string
  status: string
  totalFee: number
  paidAmount: number
  remainingBalance: number
}

interface TeacherReimbursement {
  id: string
  sessionId: string
  sessionName: string
  classTeachingRequestId: string
  guardianId: string
  className: string
  teacherFirstName: string | null
  teacherLastName: string | null
  amount: number
  status: string
  paidDate?: string | null
  notes?: string | null
  createdAt: string
}

interface Family {
  id: string
  name: string
}

interface Session {
  id: string
  name: string
}

interface FeeOverpayment {
  feeId: string
  familyName: string
  sessionName: string
  amount: number
}

interface ClassFeeSummary {
  classTeachingRequestId: string
  sessionId: string
  sessionName: string
  className: string
  feeAmount: number
  guardianId: string
  teacherFirstName: string | null
  teacherLastName: string | null
  enrolledCount: number
  totalFees: number
}

export default function PaymentsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'family' | 'classFees' | 'reimbursements'>('family')
  const [classFeeSummaries, setClassFeeSummaries] = useState<ClassFeeSummary[]>([])
  const [reimbursements, setReimbursements] = useState<TeacherReimbursement[]>([])
  const [overpayments, setOverpayments] = useState<FeeOverpayment[]>([])
  const [updatingReimbursementId, setUpdatingReimbursementId] = useState<string | null>(null)
  
  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [sortBy, setSortBy] = useState<keyof PaymentData>('paymentDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // Manual payment form states
  const [showManualPaymentForm, setShowManualPaymentForm] = useState(false)
  const [families, setFamilies] = useState<Family[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [manualPaymentForm, setManualPaymentForm] = useState({
    familyId: '',
    sessionId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    notes: ''
  })
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [loadingAmountDue, setLoadingAmountDue] = useState(false)
  const [familySessionFee, setFamilySessionFee] = useState<any>(null)
  const [reimbursementForm, setReimbursementForm] = useState({
    sessionId: '',
    classTeachingRequestId: '',
    guardianId: '',
    amount: '',
    notes: ''
  })

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/signin')
      return
    }

    fetchPayments()
    fetchFamiliesAndSessions()
    fetchClassFeeSummaries()
    fetchReimbursements()
    fetchOverpayments()
  }, [user, authLoading, router])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/payments')
      if (!response.ok) {
        throw new Error('Failed to fetch payments')
      }
      const data = await response.json()
       setPayments(data.payments || data)
       setOutstandingBalance(data.outstandingBalance || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchFamiliesAndSessions = async () => {
    try {
      const [familiesResponse, sessionsResponse] = await Promise.all([
        fetch('/api/admin/families'),
        fetch('/api/admin/sessions')
      ])
      
      if (familiesResponse.ok) {
        const familiesData = await familiesResponse.json()
        setFamilies(familiesData)
      }
      
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json()
        setSessions(sessionsData.sessions || sessionsData)
      }
    } catch (err) {
      console.error('Error fetching families and sessions:', err)
    }
  }

  const fetchClassFeeSummaries = async () => {
    try {
      const response = await fetch('/api/admin/class-fee-summary')
      if (!response.ok) {
        throw new Error('Failed to fetch class fee summary')
      }
      const data = await response.json()
      setClassFeeSummaries(data.classes || [])
    } catch (err) {
      console.error('Error fetching class fee summary:', err)
    }
  }

  const fetchReimbursements = async () => {
    try {
      const response = await fetch('/api/admin/teacher-reimbursements')
      if (!response.ok) {
        throw new Error('Failed to fetch reimbursements')
      }
      const data = await response.json()
      setReimbursements(data.reimbursements || [])
    } catch (err) {
      console.error('Error fetching reimbursements:', err)
    }
  }

  const fetchOverpayments = async () => {
    try {
      const response = await fetch('/api/admin/fee-overpayments')
      if (response.ok) setOverpayments((await response.json()).overpayments || [])
    } catch (err) {
      console.error('Error fetching overpayments:', err)
    }
  }

  const refundOverpayment = async (overpayment: FeeOverpayment, disposition: 'cash' | 'wire') => {
    const notes = window.prompt(`Optional notes for this ${disposition} refund:`)
    if (notes === null) return
    try {
      const response = await fetch('/api/admin/fee-overpayments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeId: overpayment.feeId, disposition, notes })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to refund overpayment')
      await Promise.all([fetchOverpayments(), fetchPayments()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refund overpayment')
    }
  }

  const fetchAmountDue = async () => {
    if (!manualPaymentForm.familyId || !manualPaymentForm.sessionId) {
      setError('Please select both a family and session first')
      return
    }

    try {
      setLoadingAmountDue(true)
      setError(null)
      
      const response = await fetch(
        `/api/admin/family-session-fee?familyId=${manualPaymentForm.familyId}&sessionId=${manualPaymentForm.sessionId}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch amount due')
      }

      const feeData = await response.json()
      setFamilySessionFee(feeData)
      
      // Auto-populate the amount field with the remaining balance
      setManualPaymentForm(prev => ({
        ...prev,
        amount: feeData.remainingBalance.toString()
      }))
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch amount due')
    } finally {
      setLoadingAmountDue(false)
    }
  }

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!manualPaymentForm.familyId || !manualPaymentForm.amount || !manualPaymentForm.paymentDate) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setSubmittingPayment(true)
      setError(null)
      
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familyId: manualPaymentForm.familyId,
          sessionId: manualPaymentForm.sessionId || null,
          amount: parseFloat(manualPaymentForm.amount),
          paymentDate: manualPaymentForm.paymentDate,
          paymentMethod: manualPaymentForm.paymentMethod,
          notes: manualPaymentForm.notes
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create payment')
      }

      // Reset form and refresh payments
      setManualPaymentForm({
        familyId: '',
        sessionId: '',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        notes: ''
      })
      setFamilySessionFee(null)
      setShowManualPaymentForm(false)
      await fetchPayments()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleReimbursementSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const response = await fetch('/api/admin/teacher-reimbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: reimbursementForm.sessionId,
          classTeachingRequestId: reimbursementForm.classTeachingRequestId,
          guardianId: reimbursementForm.guardianId,
          amount: parseFloat(reimbursementForm.amount),
          notes: reimbursementForm.notes
        })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create reimbursement')
      }
      setReimbursementForm({ sessionId: '', classTeachingRequestId: '', guardianId: '', amount: '', notes: '' })
      await fetchReimbursements()
      await fetchClassFeeSummaries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reimbursement')
    }
  }

  const handleReimbursementStatusToggle = async (reimbursement: TeacherReimbursement) => {
    try {
      setUpdatingReimbursementId(reimbursement.id)
      const nextStatus = reimbursement.status === 'paid' ? 'pending' : 'paid'
      const paidDate = nextStatus === 'paid'
        ? new Date().toISOString().split('T')[0]
        : null
      const response = await fetch('/api/admin/teacher-reimbursements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reimbursement.id,
          status: nextStatus,
          paidDate
        })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update reimbursement')
      }
      await fetchReimbursements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reimbursement')
    } finally {
      setUpdatingReimbursementId(null)
    }
  }

  const filteredAndSortedPayments = payments
    .filter(payment => {
      const matchesSearch = payment.familyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           payment.sessionName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
      const matchesPaymentMethod = paymentMethodFilter === 'all' || payment.paymentMethod === paymentMethodFilter
      
      let matchesDateRange = true
      if (dateRange.start && dateRange.end) {
        const paymentDate = new Date(payment.paymentDate)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        matchesDateRange = paymentDate >= startDate && paymentDate <= endDate
      }
      
      return matchesSearch && matchesStatus && matchesPaymentMethod && matchesDateRange
    })
    .sort((a, b) => {
      const aValue = a[sortBy]
      const bValue = b[sortBy]
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })

  const exportToCSV = () => {
    const headers = [
      'Family Name',
      'Session',
      'Amount',
      'Payment Date',
      'Payment Method',
      'Status',
      'Total Fee',
      'Paid Amount',
      'Remaining Balance',
      'Notes'
    ]
    
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedPayments.map(payment => [
        `"${payment.familyName}"`,
        `"${payment.sessionName}"`,
        payment.amount,
        payment.paymentDate,
        payment.paymentMethod,
        payment.status,
        payment.totalFee,
        payment.paidAmount,
        payment.remainingBalance,
        `"${payment.notes || ''}"`
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `payments-export-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSort = (column: keyof PaymentData) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatPersonName = (firstName?: string | null, lastName?: string | null) => {
    const name = [firstName, lastName].filter(Boolean).join(' ')
    return name || 'Unknown'
  }

  const formatClassFeeLabel = (summary: ClassFeeSummary) => {
    return `${summary.className} (${summary.sessionName})`
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading payments...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const reimbursementLookup = new Map(
    reimbursements.map(reimbursement => [
      `${reimbursement.classTeachingRequestId}-${reimbursement.sessionId}`,
      reimbursement
    ])
  )
  const totalClassFees = classFeeSummaries.reduce((sum, item) => sum + item.totalFees, 0)
  const selectedClassFeeSummary = classFeeSummaries.find(
    item => item.classTeachingRequestId === reimbursementForm.classTeachingRequestId
  )

  return (
    <AdminLayout userName={userName || 'Admin'} activeTab="payments">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Management</h1>
          <p className="text-gray-600">View, filter, and export all fee payments</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('family')}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                activeTab === 'family'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Family Payments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('classFees')}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                activeTab === 'classFees'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Class Fees
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reimbursements')}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                activeTab === 'reimbursements'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Teacher Reimbursements
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {activeTab === 'family' && (
          <>
            {overpayments.length > 0 && <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-6"><h2 className="text-lg font-semibold text-amber-900">Unresolved Family Overpayments</h2><p className="mt-1 text-sm text-amber-800">Issue a cash or wire refund. The adjustment is recorded in payment history and cannot be processed twice.</p><div className="mt-4 space-y-3">{overpayments.map((overpayment) => <div key={overpayment.feeId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-white p-3"><div className="text-sm text-gray-700"><span className="font-medium">{overpayment.familyName}</span> · {overpayment.sessionName} · <span className="font-semibold">{formatCurrency(overpayment.amount)}</span></div><div className="flex gap-2"><button type="button" onClick={() => refundOverpayment(overpayment, 'cash')} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">Refund Cash</button><button type="button" onClick={() => refundOverpayment(overpayment, 'wire')} className="rounded-md bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700">Refund Wire</button></div></div>)}</div></div>}
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    placeholder="Search families or sessions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Methods</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="online">Online</option>
                    <option value="scholarship">Scholarship</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Export
                  </label>
                  <button
                    onClick={exportToCSV}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Export to CSV
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manual Payment
                  </label>
                  <button
                    onClick={() => setShowManualPaymentForm(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Add Payment
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Payments</div>
                <div className="text-2xl font-bold text-gray-900">{filteredAndSortedPayments.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Amount</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(filteredAndSortedPayments.reduce((sum, p) => sum + p.amount, 0))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Outstanding Balance</div>
                <div className="text-2xl font-bold text-red-600">
                   {formatCurrency(outstandingBalance)}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Paid Families</div>
                <div className="text-2xl font-bold text-blue-600">
                  {filteredAndSortedPayments.filter(p => p.status === 'paid').length}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('familyName')}
                      >
                        Family Name
                        {sortBy === 'familyName' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('sessionName')}
                      >
                        Session
                        {sortBy === 'sessionName' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('amount')}
                      >
                        Amount
                        {sortBy === 'amount' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('paymentDate')}
                      >
                        Payment Date
                        {sortBy === 'paymentDate' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('paymentMethod')}
                      >
                        Method
                        {sortBy === 'paymentMethod' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('status')}
                      >
                        Status
                        {sortBy === 'status' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('remainingBalance')}
                      >
                        Balance
                        {sortBy === 'remainingBalance' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.familyName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.sessionName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {payment.paymentMethod}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            payment.status === 'paid' 
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-800'
                              : payment.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payment.remainingBalance)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {payment.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredAndSortedPayments.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-500">No payments found matching your criteria.</div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'classFees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Classes With Fees</div>
                <div className="text-2xl font-bold text-gray-900">{classFeeSummaries.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Enrolled</div>
                <div className="text-2xl font-bold text-blue-600">
                  {classFeeSummaries.reduce((sum, item) => sum + item.enrolledCount, 0)}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Fees Owed</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalClassFees)}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee / Student</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Enrolled</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fees</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reimbursement</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {classFeeSummaries.map(summary => {
                      const reimbursement = reimbursementLookup.get(
                        `${summary.classTeachingRequestId}-${summary.sessionId}`
                      )
                      return (
                        <tr key={`${summary.classTeachingRequestId}-${summary.sessionId}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{summary.sessionName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{summary.className}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatPersonName(summary.teacherFirstName, summary.teacherLastName)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(summary.feeAmount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {summary.enrolledCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(summary.totalFees)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {reimbursement ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                reimbursement.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {reimbursement.status}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">Not recorded</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {classFeeSummaries.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-500">No class fees found for enrolled students.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reimbursements' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Teacher Reimbursement</h2>
              <form onSubmit={handleReimbursementSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label>
                  <select
                    value={reimbursementForm.sessionId}
                    onChange={(e) => setReimbursementForm(prev => ({
                      ...prev,
                      sessionId: e.target.value,
                      classTeachingRequestId: '',
                      guardianId: ''
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a session</option>
                    <SessionOptions sessions={sessions as Array<{ id: string; name: string; startDate: string; endDate: string }>} />
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                  <select
                    value={reimbursementForm.classTeachingRequestId}
                    onChange={(e) => {
                      const summary = classFeeSummaries.find(item => item.classTeachingRequestId === e.target.value)
                      setReimbursementForm(prev => ({
                        ...prev,
                        classTeachingRequestId: e.target.value,
                        guardianId: summary?.guardianId || '',
                        sessionId: summary?.sessionId || prev.sessionId,
                        amount: summary?.totalFees ? summary.totalFees.toString() : prev.amount
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a class</option>
                    {(reimbursementForm.sessionId
                      ? classFeeSummaries.filter(summary => summary.sessionId === reimbursementForm.sessionId)
                      : classFeeSummaries
                    ).map(summary => (
                      <option key={summary.classTeachingRequestId} value={summary.classTeachingRequestId}>
                        {formatClassFeeLabel(summary)}
                      </option>
                    ))}
                  </select>
                  {reimbursementForm.classTeachingRequestId && (
                    <p className="mt-2 text-sm text-gray-600">
                      Enrolled: {selectedClassFeeSummary?.enrolledCount || 0} ·
                      Total fees: {formatCurrency(selectedClassFeeSummary?.totalFees || 0)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={reimbursementForm.amount}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={reimbursementForm.notes}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional notes"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Create Reimbursement
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Enrolled</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Total</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Reimbursement</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reimbursements.map(reimbursement => {
                      const summary = classFeeSummaries.find(item => (
                        item.classTeachingRequestId === reimbursement.classTeachingRequestId &&
                        item.sessionId === reimbursement.sessionId
                      ))
                      return (
                        <tr key={reimbursement.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reimbursement.sessionName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{reimbursement.className}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatPersonName(reimbursement.teacherFirstName, reimbursement.teacherLastName)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {summary?.enrolledCount ?? 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(summary?.totalFees ?? 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(reimbursement.amount)}
                          </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            reimbursement.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {reimbursement.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {reimbursement.paidDate ? formatDate(reimbursement.paidDate) : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{reimbursement.notes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleReimbursementStatusToggle(reimbursement)}
                            disabled={updatingReimbursementId === reimbursement.id}
                            className={`px-3 py-1 rounded-md text-sm font-medium ${
                              reimbursement.status === 'paid'
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            } disabled:opacity-50`}
                          >
                            {updatingReimbursementId === reimbursement.id
                              ? 'Updating...'
                              : reimbursement.status === 'paid'
                              ? 'Mark Pending'
                              : 'Mark Paid'}
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {reimbursements.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-500">No reimbursements recorded yet.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'family' && showManualPaymentForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Manual Payment</h3>
              
              <form onSubmit={handleManualPaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Family *
                  </label>
                  <select
                    value={manualPaymentForm.familyId}
                    onChange={(e) => {
                      setManualPaymentForm(prev => ({ ...prev, familyId: e.target.value }))
                      setFamilySessionFee(null) // Clear fee info when family changes
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a family</option>
                    {families.map(family => (
                      <option key={family.id} value={family.id}>{family.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session (Optional)
                  </label>
                  <select
                    value={manualPaymentForm.sessionId}
                    onChange={(e) => {
                      setManualPaymentForm(prev => ({ ...prev, sessionId: e.target.value }))
                      setFamilySessionFee(null) // Clear fee info when session changes
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No specific session</option>
                    <SessionOptions sessions={sessions as Array<{ id: string; name: string; startDate: string; endDate: string }>} />
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={manualPaymentForm.amount}
                      onChange={(e) => setManualPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      required
                    />
                    <button
                      type="button"
                      onClick={fetchAmountDue}
                      disabled={!manualPaymentForm.familyId || !manualPaymentForm.sessionId || loadingAmountDue}
                      className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md whitespace-nowrap"
                    >
                      {loadingAmountDue ? 'Loading...' : 'Use Amount Due'}
                    </button>
                  </div>
                  
                  {familySessionFee && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                      <div className="font-medium text-blue-900">Fee Information:</div>
                      <div className="text-blue-700 mt-1">
                        <div>Total Fee: {formatCurrency(familySessionFee.totalFee)}</div>
                        <div>Paid Amount: {formatCurrency(familySessionFee.paidAmount)}</div>
                        <div className="font-medium">Remaining Balance: {formatCurrency(familySessionFee.remainingBalance)}</div>
                        <div>Status: <span className="capitalize">{familySessionFee.status}</span></div>
                      </div>
                    </div>
                  )}
                  
                  {!manualPaymentForm.familyId || !manualPaymentForm.sessionId ? (
                    <div className="mt-1 text-xs text-gray-500">
                      Select a family and session to use the "Amount Due" feature
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={manualPaymentForm.paymentDate}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={manualPaymentForm.paymentMethod}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={manualPaymentForm.notes}
                    onChange={(e) => setManualPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Optional notes about this payment..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowManualPaymentForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    disabled={submittingPayment}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    disabled={submittingPayment}
                  >
                    {submittingPayment ? 'Adding...' : 'Add Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
