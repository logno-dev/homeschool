'use client'

import { useState } from 'react'
import { MockElements, MockCardElement, useStripe } from './MockStripeElements'
import Button from './Button'

interface PaymentFormProps {
  familySessionFeeId: string
  amount: number
  onSuccess: () => void
  onCancel: () => void
}

export function PaymentForm({ familySessionFeeId, amount, onSuccess, onCancel }: PaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [customAmount, setCustomAmount] = useState(amount.toString())
  const [useCustomAmount, setUseCustomAmount] = useState(false)

  const stripe = useStripe()

  const handleCardChange = (event: { complete: boolean; error?: { message: string } }) => {
    setCardComplete(event.complete)
    setCardError(event.error?.message || null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!stripe || !cardComplete) {
      return
    }

    setIsProcessing(true)
    setPaymentError(null)

    try {
      const paymentAmount = useCustomAmount ? parseFloat(customAmount) : amount

      if (paymentAmount <= 0 || paymentAmount > amount) {
        setPaymentError(`Payment amount must be between $0.01 and $${amount.toFixed(2)}`)
        setIsProcessing(false)
        return
      }

      // Create payment intent
      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familySessionFeeId,
          amount: paymentAmount
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payment intent')
      }

      const { clientSecret } = await response.json()

      // Confirm payment with mock Stripe
      const result = await stripe.confirmCardPayment(clientSecret)

      if (result.error) {
        setPaymentError(result.error.message)
      } else if (result.paymentIntent?.status === 'succeeded') {
        // Update payment status via webhook simulation
        await fetch('/api/payments/confirm-payment', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentIntentId: result.paymentIntent.id,
            status: 'succeeded',
            amount: Math.round(paymentAmount * 100), // Convert to cents
            familySessionFeeId
          }),
        })

        onSuccess()
      }
    } catch (error) {
      console.error('Payment error:', error)
      setPaymentError(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <MockElements>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
          
          <div className="mb-4">
            <div className="flex items-center space-x-4 mb-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useCustomAmount}
                  onChange={() => setUseCustomAmount(false)}
                  className="mr-2"
                />
                Pay full amount: ${amount.toFixed(2)}
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useCustomAmount}
                  onChange={() => setUseCustomAmount(true)}
                  className="mr-2"
                />
                Pay custom amount
              </label>
            </div>
            
            {useCustomAmount && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    min="0.01"
                    max={amount}
                    step="0.01"
                    className="pl-8 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Maximum: ${amount.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details
          </label>
          <MockCardElement onChange={handleCardChange} />
        </div>

        {cardError && (
          <div className="text-red-600 text-sm">{cardError}</div>
        )}

        {paymentError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="text-red-800 text-sm">{paymentError}</div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!cardComplete || isProcessing}
            className="min-w-[120px]"
          >
            {isProcessing ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              `Pay $${(useCustomAmount ? parseFloat(customAmount) || 0 : amount).toFixed(2)}`
            )}
          </Button>
        </div>
      </form>
    </MockElements>
  )
}