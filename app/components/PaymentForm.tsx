'use client'

import { useEffect, useState } from 'react'
import Button from './Button'
import PayPalCheckout from './PayPalCheckout'

interface PaymentFormProps {
  familySessionFeeId: string
  amount: number
  onSuccess: () => void
  onCancel: () => void
  cancelLabel?: string
}

export function PaymentForm({ familySessionFeeId, amount, onSuccess, onCancel, cancelLabel = 'Cancel' }: PaymentFormProps) {
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [customAmount, setCustomAmount] = useState(amount.toString())
  const [useCustomAmount, setUseCustomAmount] = useState(false)
  const [includeDonation, setIncludeDonation] = useState(false)
  const [donationPreset, setDonationPreset] = useState<number | null>(null)
  const [donationAmount, setDonationAmount] = useState('')
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [environment, setEnvironment] = useState<'sandbox' | 'live' | null>(null)
  const [expectedFeeAmountCents, setExpectedFeeAmountCents] = useState<number>(0)
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

  const paymentAmount = useCustomAmount ? parseFloat(customAmount) : amount
  const resolvedDonationAmount = includeDonation
    ? (donationPreset ?? parseFloat(donationAmount))
    : 0
  const totalCharge = (Number.isFinite(paymentAmount) ? paymentAmount : 0) + (Number.isFinite(resolvedDonationAmount) ? resolvedDonationAmount : 0)

  useEffect(() => {
    setPaymentError(null)
    setOrderId(null)
    setClientId('')
  }, [useCustomAmount, customAmount, includeDonation, donationPreset, donationAmount, amount])

  const createOrder = async () => {
    setPaymentError(null)

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > amount) {
      setPaymentError(`Payment amount must be between $0.01 and $${amount.toFixed(2)}`)
      return
    }

    if (includeDonation && (!resolvedDonationAmount || Number.isNaN(resolvedDonationAmount) || resolvedDonationAmount <= 0)) {
      setPaymentError('Please enter a valid scholarship donation amount.')
      return
    }

    try {
      setIsCreatingOrder(true)

      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          familySessionFeeId,
          amount: paymentAmount,
          donationAmount: resolvedDonationAmount
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payment order')
      }

      const data = await response.json()
      setOrderId(data.orderId)
      setClientId(data.clientId)
      setExpectedFeeAmountCents(Number.isFinite(data.expectedFeeAmountCents) ? Number(data.expectedFeeAmountCents) : 0)
      setExpectedDonationAmountCents(Number.isFinite(data.expectedDonationAmountCents) ? Number(data.expectedDonationAmountCents) : 0)
      const parsedEnvironment = data.environment === 'sandbox' ? 'sandbox' : data.environment === 'live' ? 'live' : data.isSandbox ? 'sandbox' : 'live'
      setEnvironment(parsedEnvironment)
    } catch (error) {
      console.error('Error creating payment order:', error)
      setPaymentError(error instanceof Error ? error.message : 'Unable to start payment')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  const handleApprove = async (approvedOrderId: string) => {
    try {
      const response = await fetch('/api/payments/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: approvedOrderId,
          status: 'succeeded',
          familySessionFeeId,
          expectedFeeAmountCents,
          expectedDonationAmountCents
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to confirm payment')
      }

      onSuccess()
    } catch (error) {
      console.error('Error confirming payment:', error)
      setPaymentError(error instanceof Error ? error.message : 'Payment confirmation failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Payment Information</h3>

        <div className="mb-4">
          <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:space-x-6 mb-4">
            <label className="flex items-center p-3 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none cursor-pointer touch-manipulation">
              <input
                type="radio"
                checked={!useCustomAmount}
                onChange={() => setUseCustomAmount(false)}
                className="mr-3 sm:mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-sm sm:text-base font-medium">
                Pay full amount: ${amount.toFixed(2)}
              </span>
            </label>
            <label className="flex items-center p-3 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none cursor-pointer touch-manipulation">
              <input
                type="radio"
                checked={useCustomAmount}
                onChange={() => setUseCustomAmount(true)}
                className="mr-3 sm:mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-sm sm:text-base font-medium">
                Pay custom amount
              </span>
            </label>
          </div>

          {useCustomAmount && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">$</span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="0.01"
                  max={amount}
                  step="0.01"
                  className="pl-8 w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Maximum: ${amount.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
        <label className="flex items-center gap-3 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={includeDonation}
            onChange={(event) => {
              setIncludeDonation(event.target.checked)
              if (!event.target.checked) {
                setDonationPreset(null)
                setDonationAmount('')
              }
            }}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
          />
          Add a scholarship fund donation
        </label>
        {includeDonation && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => {
                    setDonationPreset(preset)
                    setDonationAmount(preset.toString())
                  }}
                  className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                    donationPreset === preset
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-indigo-200 hover:border-indigo-400'
                  }`}
                >
                  ${preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDonationPreset(null)}
                className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                  donationPreset === null
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-indigo-200 hover:border-indigo-400'
                }`}
              >
                Custom
              </button>
            </div>
            {donationPreset === null && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Donation Amount
                </label>
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
            {resolvedDonationAmount > 0 && (
              <p className="text-sm text-indigo-700">
                Scholarship donation: ${resolvedDonationAmount.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>

      {environment && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          PayPal mode: <span className="font-semibold">{environment === 'sandbox' ? 'Sandbox (Testing)' : 'Live'}</span>
        </div>
      )}

      {paymentError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-red-800 text-sm">{paymentError}</div>
        </div>
      )}

      {!orderId && (
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isCreatingOrder}
            className="w-full sm:w-auto py-3 sm:py-2 text-base sm:text-sm"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={createOrder}
            disabled={isCreatingOrder}
            className="w-full sm:w-auto sm:min-w-[220px] py-3 sm:py-2 text-base sm:text-sm font-semibold"
          >
            {isCreatingOrder
              ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-4 sm:w-4 border-b-2 border-white mr-2" />
                  Creating checkout...
                </div>
              )
              : `Pay $${totalCharge.toFixed(2)} with PayPal`
            }
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
          onError={(message) => setPaymentError(message)}
        />
      ) : null}
    </div>
  )
}
