'use client'

import { useState, useEffect } from 'react'

interface PaymentRecord {
  id: string
  amount: number
  paymentDate: string
  paymentMethod: string
  notes: string | null
  sessionName: string
  sessionId: string
  totalFee: number
  registrationFee: number
  classFees: number
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPaymentHistory()
  }, [])

  const fetchPaymentHistory = async () => {
    try {
      const response = await fetch('/api/family/payment-history')
      if (!response.ok) {
        throw new Error('Failed to fetch payment history')
      }
      const data = await response.json()
      setPayments(data.payments || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history')
    } finally {
      setLoading(false)
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPaymentMethodDisplay = (method: string) => {
    switch (method) {
      case 'online':
        return '💳 Online Payment'
      case 'cash':
        return '💵 Cash'
      case 'check':
        return '📝 Check'
      default:
        return method
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        Error loading payment history: {error}
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        <div className="text-4xl mb-2">💳</div>
        <div>No payment history found</div>
        <div className="text-xs mt-1">Payments will appear here once made</div>
      </div>
    )
  }

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
        <div className="text-right">
          <div className="text-sm text-gray-600">Total Paid</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {payments.map((payment) => (
          <div key={payment.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-gray-900">{payment.sessionName}</span>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-600">{getPaymentMethodDisplay(payment.paymentMethod)}</span>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {formatDate(payment.paymentDate)}
                </div>
                {payment.notes && (
                  <div className="text-sm text-gray-500 italic">
                    {payment.notes}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(payment.amount)}
                </div>
                <div className="text-xs text-gray-500">
                  of {formatCurrency(payment.totalFee)} total
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-100">
        🔒 All payments are processed securely. For questions about payments, please contact the office.
      </div>
    </div>
  )
}