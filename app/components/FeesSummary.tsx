'use client'

import { useState, useEffect } from 'react'
import { PaymentForm } from './PaymentForm'
import Modal from './Modal'
import Button from './Button'

interface FeeData {
  id: string
  sessionId: string
  sessionName: string
  registrationFee: number
  classFees: number
  totalFee: number
  paidAmount: number
  status: string
  dueDate: string
  calculatedAt: string
  isOverdue: boolean
  remainingAmount: number
}

export default function FeesSummary() {
  const [fees, setFees] = useState<FeeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFee, setSelectedFee] = useState<FeeData | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    fetchFees()
  }, [])

  const fetchFees = async () => {
    try {
      console.log('Fetching fees...')
      const response = await fetch('/api/family/fees')
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        throw new Error(`Failed to fetch fees: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Fees data:', data)
      setFees(data.fees || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load fees')
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
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-100'
      case 'partial':
        return 'text-yellow-600 bg-yellow-100'
      case 'overdue':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const handlePaymentClick = (fee: FeeData) => {
    setSelectedFee(fee)
    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false)
    setSelectedFee(null)
    fetchFees() // Refresh the fees data
  }

  const handlePaymentCancel = () => {
    setShowPaymentModal(false)
    setSelectedFee(null)
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        Error loading fees: {error}
      </div>
    )
  }

  if (fees.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No fees calculated yet
      </div>
    )
  }

  const totalOwed = fees.reduce((sum, fee) => sum + (fee.totalFee - fee.paidAmount), 0)
  const nextDueDate = fees
    .filter(fee => fee.totalFee > fee.paidAmount)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]?.dueDate

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Total Outstanding:</span>
        <span className="text-lg font-bold text-gray-900">{formatCurrency(totalOwed)}</span>
      </div>
      
      {nextDueDate && totalOwed > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Next Due Date:</span>
          <span className="text-sm text-gray-900">{formatDate(nextDueDate)}</span>
        </div>
      )}

      {fees.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Session Breakdown:</h4>
          {fees.map((fee) => (
            <div key={fee.sessionId} className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">{fee.sessionName}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(fee.status)}`}>
                  {fee.status}
                </span>
                {fee.isOverdue && (
                  <span className="text-red-600 text-xs font-medium">OVERDUE</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">
                  {formatCurrency(fee.remainingAmount)}
                </span>
                {fee.remainingAmount > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handlePaymentClick(fee)}
                  >
                    Pay Now
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalOwed > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={() => {
              const firstUnpaidFee = fees.find(fee => fee.remainingAmount > 0)
              if (firstUnpaidFee) handlePaymentClick(firstUnpaidFee)
            }}
            className="w-full"
          >
            Pay Outstanding Balance ({formatCurrency(totalOwed)})
          </Button>
        </div>
      )}

      {showPaymentModal && selectedFee && (
        <Modal
          isOpen={showPaymentModal}
          onClose={handlePaymentCancel}
          title={`Pay Session Fee - ${selectedFee.sessionName}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Registration Fee:</span>
                  <span className="ml-2 font-medium">{formatCurrency(selectedFee.registrationFee)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Class Fees:</span>
                  <span className="ml-2 font-medium">{formatCurrency(selectedFee.classFees)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Fee:</span>
                  <span className="ml-2 font-medium">{formatCurrency(selectedFee.totalFee)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="ml-2 font-medium">{formatCurrency(selectedFee.paidAmount)}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Amount Due:</span>
                  <span className="ml-2 font-bold text-lg">{formatCurrency(selectedFee.remainingAmount)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="ml-2 font-medium">{formatDate(selectedFee.dueDate)}</span>
                  {selectedFee.isOverdue && (
                    <span className="ml-2 text-red-600 font-medium">(OVERDUE)</span>
                  )}
                </div>
              </div>
            </div>

            <PaymentForm
              familySessionFeeId={selectedFee.id}
              amount={selectedFee.remainingAmount}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}