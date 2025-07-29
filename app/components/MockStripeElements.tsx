'use client'

import { useState } from 'react'

interface MockCardElementProps {
  onChange: (event: { complete: boolean; error?: { message: string } }) => void
}

export function MockCardElement({ onChange }: MockCardElementProps) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [error, setError] = useState('')

  const validateCard = (number: string, exp: string, cvcValue: string) => {
    // Basic validation for demo purposes
    const isNumberValid = number.replace(/\s/g, '').length >= 13
    const isExpiryValid = /^\d{2}\/\d{2}$/.test(exp)
    const isCvcValid = cvcValue.length >= 3
    
    const complete = isNumberValid && isExpiryValid && isCvcValid
    
    let errorMessage = ''
    if (number && !isNumberValid) errorMessage = 'Invalid card number'
    else if (exp && !isExpiryValid) errorMessage = 'Invalid expiry date'
    else if (cvcValue && !isCvcValid) errorMessage = 'Invalid CVC'
    
    setError(errorMessage)
    onChange({ 
      complete, 
      error: errorMessage ? { message: errorMessage } : undefined 
    })
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }

  return (
    <div className="border border-gray-300 rounded-md p-4 bg-white">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Card Number
          </label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => {
              const formatted = formatCardNumber(e.target.value)
              setCardNumber(formatted)
              validateCard(formatted, expiry, cvc)
            }}
            placeholder="1234 5678 9012 3456"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={19}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date
            </label>
            <input
              type="text"
              value={expiry}
              onChange={(e) => {
                const formatted = formatExpiry(e.target.value)
                setExpiry(formatted)
                validateCard(cardNumber, formatted, cvc)
              }}
              placeholder="MM/YY"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={5}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CVC
            </label>
            <input
              type="text"
              value={cvc}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '')
                setCvc(value)
                validateCard(cardNumber, expiry, value)
              }}
              placeholder="123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={4}
            />
          </div>
        </div>
        
        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}
        
        <div className="text-xs text-gray-500 mt-2">
          🔒 This is a mock payment form for testing. No real charges will be made.
        </div>
      </div>
    </div>
  )
}

interface MockElementsProps {
  children: React.ReactNode
}

export function MockElements({ children }: MockElementsProps) {
  return <div>{children}</div>
}

// Mock useStripe and useElements hooks
export function useStripe() {
  return {
    confirmCardPayment: async (clientSecret: string) => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock payment confirmation
      const shouldSucceed = Math.random() > 0.1 // 90% success rate
      
      if (shouldSucceed) {
        return {
          paymentIntent: {
            id: clientSecret.split('_secret_')[0],
            status: 'succeeded'
          }
        }
      } else {
        return {
          error: {
            type: 'card_error',
            code: 'card_declined',
            message: 'Your card was declined. Please try a different payment method.'
          }
        }
      }
    }
  }
}

export function useElements() {
  return {
    getElement: () => ({
      // Mock element methods
    })
  }
}