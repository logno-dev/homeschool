'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { MockElements, MockCardElement, useStripe } from './MockStripeElements'

interface ScholarshipDonationModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export default function ScholarshipDonationModal({ isOpen, onClose, title }: ScholarshipDonationModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [donationError, setDonationError] = useState<string | null>(null)
  const [donationPreset, setDonationPreset] = useState<number | null>(10)
  const [donationAmount, setDonationAmount] = useState('10')
  const [showSuccess, setShowSuccess] = useState(false)

  const stripe = useStripe()

  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false)
      setDonationError(null)
      setCardError(null)
      setIsProcessing(false)
    }
  }, [isOpen])

  const handleCardChange = (event: { complete: boolean; error?: { message: string } }) => {
    setCardComplete(event.complete)
    setCardError(event.error?.message || null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !cardComplete) {
      return
    }

    const resolvedAmount = donationPreset ?? parseFloat(donationAmount)
    if (!resolvedAmount || Number.isNaN(resolvedAmount) || resolvedAmount <= 0) {
      setDonationError('Please enter a valid donation amount.')
      return
    }

    setIsProcessing(true)
    setDonationError(null)

    try {
      const response = await fetch('/api/scholarship-fund/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: resolvedAmount })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create donation intent')
      }

      const { clientSecret } = await response.json()
      const result = await stripe.confirmCardPayment(clientSecret)

      if (result.error) {
        setDonationError(result.error.message)
      } else if (result.paymentIntent?.status === 'succeeded') {
        await fetch('/api/scholarship-fund/confirm-payment', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentIntentId: result.paymentIntent.id,
            status: 'succeeded',
            amount: Math.round(resolvedAmount * 100)
          })
        })

        setShowSuccess(true)
      }
    } catch (error) {
      console.error('Donation error:', error)
      setDonationError(error instanceof Error ? error.message : 'Donation failed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Donate to the Scholarship Fund'}
      size="lg"
    >
      <MockElements>
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
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Card Details</label>
              <div className="p-1">
                <MockCardElement onChange={handleCardChange} />
              </div>
            </div>

            {cardError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-red-600 text-sm">{cardError}</div>
              </div>
            )}

            {donationError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-red-800 text-sm">{donationError}</div>
              </div>
            )}

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
                type="submit"
                disabled={!cardComplete || isProcessing}
                className="w-full sm:w-auto sm:min-w-[120px] py-3 sm:py-2 text-base sm:text-sm font-semibold"
              >
                {isProcessing ? 'Processing...' : `Donate $${(donationPreset ?? (parseFloat(donationAmount) || 0)).toFixed(2)}`}
              </Button>
            </div>
          </form>
        )}
      </MockElements>
    </Modal>
  )
}
