'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

interface FeeStatus {
  id: string
  sessionId: string
  familyId: string
  registrationFee: number
  classFees: number
  totalFee: number
  paidAmount: number
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  dueDate: string
  isOverdue: boolean
  remainingAmount: number
  calculatedAt: string
}

interface FamilyFeeStatusProps {
  sessionId: string
  sessionName: string
}

export default function FamilyFeeStatus({ sessionId, sessionName }: FamilyFeeStatusProps) {
  const [feeStatus, setFeeStatus] = useState<FeeStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFeeStatus()
  }, [sessionId])

  const fetchFeeStatus = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/family/fees/${sessionId}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to view fee information')
          return
        }
        throw new Error('Failed to fetch fee status')
      }

      const data = await response.json()
      if (data.success) {
        setFeeStatus(data.feeStatus)
      } else {
        setFeeStatus(null)
      }
    } catch (error) {
      console.error('Error fetching fee status:', error)
      setError('Failed to load fee information')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'text-red-600 bg-red-50'
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50'
      case 'partial': return 'text-yellow-600 bg-yellow-50'
      case 'pending': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusText = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'Overdue'
    switch (status) {
      case 'paid': return 'Paid in Full'
      case 'partial': return 'Partially Paid'
      case 'pending': return 'Payment Pending'
      default: return 'Unknown'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Fee Status - {sessionName}</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Fee Status - {sessionName}</h3>
        <div className="text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      </div>
    )
  }

  if (!feeStatus) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Fee Status - {sessionName}</h3>
        <div className="text-gray-500">
          No fees have been calculated for this session yet. Fees will be calculated after registration is completed.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Fee Status - {sessionName}</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(feeStatus.status, feeStatus.isOverdue)}`}>
          {getStatusText(feeStatus.status, feeStatus.isOverdue)}
        </span>
      </div>

      <div className="space-y-4">
        {/* Fee Breakdown */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-medium mb-3">Fee Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Registration Fee:</span>
              <span>${feeStatus.registrationFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Class Fees:</span>
              <span>${feeStatus.classFees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-2">
              <span>Total Amount:</span>
              <span>${feeStatus.totalFee.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Payment Status</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Amount Paid:</span>
              <span className="text-green-600">${feeStatus.paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining Balance:</span>
              <span className={feeStatus.remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                ${feeStatus.remainingAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Due Date:</span>
              <span className={feeStatus.isOverdue ? 'text-red-600 font-medium' : ''}>
                {format(parseISO(feeStatus.dueDate), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        {feeStatus.remainingAmount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Payment Instructions</h4>
            <p className="text-sm text-blue-700">
              Please contact the school office to arrange payment of your remaining balance of ${feeStatus.remainingAmount.toFixed(2)}. 
              Payment methods include cash, check, or online payment.
            </p>
            {feeStatus.isOverdue && (
              <p className="text-sm text-red-700 mt-2 font-medium">
                This payment is overdue. Please contact the office as soon as possible.
              </p>
            )}
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Fees calculated on: {format(parseISO(feeStatus.calculatedAt), 'MMM d, yyyy h:mm a')}
        </div>
      </div>
    </div>
  )
}