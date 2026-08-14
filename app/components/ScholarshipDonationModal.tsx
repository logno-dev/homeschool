'use client'

import { useEffect, useState } from 'react'
import Button from './Button'
import Modal from './Modal'
import PayPalCheckout from './PayPalCheckout'

interface ScholarshipDonationModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export default function ScholarshipDonationModal({ isOpen, onClose, title }: ScholarshipDonationModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [donationError, setDonationError] = useState<string | null>(null)
  const [donationPreset, setDonationPreset] = useState<number | null>(10)
  const [donationAmount, setDonationAmount] = useState('10')
  const [showSuccess, setShowSuccess] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [environment, setEnvironment] = useState<'sandbox' | 'live' | null>(null)
  const [expectedDonationAmountCents, setExpectedDonationAmountCents] = useState<number>(0)

  useEffect(() => {
    const loadEnvironment = async () => {
      try {
        const response = await fetch('/api/payments/paypal-config')

        if (!response.ok) {
          return
        }

        const data = await response.json()
        const parsedEnvironment = data.environment === 'sandbox' ? 'sandbox' : data.environment === 'live' ? 'live' : data.isSandbox ? 'sandbox' : 'live'
        setEnvironment(parsedEnvironment)
      } catch {
        return
      }
    }

    loadEnvironment()
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false)
      setDonationError(null)
      setIsProcessing(false)
      setOrderId(null)
      setClientId('')
    }
  }, [isOpen])

  const resolvedAmount = donationPreset ?? parseFloat(donationAmount)

  const createOrder = async () => {
    setDonationError(null)

    if (!resolvedAmount || Number.isNaN(resolvedAmount) || resolvedAmount <= 0) {
      setDonationError('Please enter a valid donation amount.')
      return
    }

    try {
      setIsProcessing(true)

      const response = await fetch('/api/scholarship-fund/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: resolvedAmount })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create donation order')
      }

      const data = await response.json()
      setOrderId(data.orderId)
      setClientId(data.clientId)
      setExpectedDonationAmountCents(Number.isFinite(data.expectedDonationAmountCents) ? Number(data.expectedDonationAmountCents) : 0)
      const parsedEnvironment = data.environment === 'sandbox' ? 'sandbox' : data.environment === 'live' ? 'live' : data.isSandbox ? 'sandbox' : 'live'
      setEnvironment(parsedEnvironment)
    } catch (error) {
      console.error('Donation error:', error)
      setDonationError(error instanceof Error ? error.message : 'Donation failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApprove = async (approvedOrderId: string) => {
    try {
      const response = await fetch('/api/scholarship-fund/confirm-payment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: approvedOrderId,
          status: 'succeeded',
          expectedDonationAmountCents
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to record donation')
      }

      setShowSuccess(true)
    } catch (error) {
      console.error('Donation error:', error)
      setDonationError(error instanceof Error ? error.message : 'Donation failed')
      setOrderId(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Donate to the Scholarship Fund'}
      size="lg"
    >
      {showSuccess ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-700">
            Thank you for supporting the scholarship fund. Your donation has been recorded.
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Donation Amount</h3>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDonationPreset(preset)
                    setDonationAmount(preset.toString())
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                    donationPreset === preset
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  ${preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDonationPreset(null)}
                className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                  donationPreset === null
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                }`}
              >
                Custom
              </button>
            </div>
            {donationPreset === null && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Custom Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={donationAmount}
                    onChange={(event) => setDonationAmount(event.target.value)}
                    className="pl-8 w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          {environment && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              PayPal mode: <span className="font-semibold">{environment === 'sandbox' ? 'Sandbox (Testing)' : 'Live'}</span>
            </div>
          )}

          {donationError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-red-800 text-sm">{donationError}</div>
            </div>
          )}

          {!orderId && (
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isProcessing}
                className="w-full sm:w-auto py-3 sm:py-2 text-base sm:text-sm"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={createOrder}
                disabled={isProcessing}
                className="w-full sm:w-auto sm:min-w-[120px] py-3 sm:py-2 text-base sm:text-sm font-semibold"
              >
                {isProcessing ? 'Processing...' : `Donate $${(resolvedAmount || 0).toFixed(2)}`}
              </Button>
            </div>
          )}

          {orderId ? (
            <PayPalCheckout
              orderId={orderId}
              clientId={clientId}
              onApprove={handleApprove}
              onCancel={() => {
                setOrderId(null)
              }}
              onError={(message) => {
                setDonationError(message)
                setOrderId(null)
              }}
            />
          ) : null}
        </div>
      )}
    </Modal>
  )
}
