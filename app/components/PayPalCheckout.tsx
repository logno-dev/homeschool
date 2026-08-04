'use client'

import { useEffect, useRef, useState } from 'react'

interface PayPalCheckoutProps {
  orderId: string
  clientId: string
  onApprove: (orderId: string) => Promise<void>
  onError: (message: string) => void
  onCancel?: () => void
  disabled?: boolean
  className?: string
}

interface PayPalButtons {
  render: (container: string | HTMLElement) => void
  close: () => void
}

interface PayPalSdk {
  Buttons: (options: {
    createOrder: () => string | Promise<string>
    onApprove: (data: { orderID: string }) => Promise<void> | void
    onCancel: () => void
    onError: (error: unknown) => void
    style?: {
      layout?: 'vertical' | 'horizontal'
      shape?: 'rect' | 'pill'
      color?: 'gold' | 'blue' | 'silver' | 'white' | 'black'
      label?: 'paypal' | 'checkout' | 'pay'
      height?: number
    }
  }) => PayPalButtons
}

declare global {
  interface Window {
    paypal?: PayPalSdk
  }
}

let scriptLoadPromise: Promise<void> | null = null
let activeClientId: string | null = null

function loadPayPalScript(clientId: string) {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  if (window.paypal && activeClientId === clientId) {
    return Promise.resolve()
  }

  if (activeClientId && activeClientId !== clientId) {
    const oldScript = document.getElementById('paypal-sdk-script')
    if (oldScript) {
      oldScript.remove()
    }
    delete (window as Window & { paypal?: unknown }).paypal
    activeClientId = null
  }

  const existingScript = document.getElementById('paypal-sdk-script') as HTMLScriptElement | null
  if (existingScript) {
    if (existingScript.dataset.clientId === clientId && !window.paypal) {
        return new Promise<void>((resolve, reject) => {
        existingScript.addEventListener('load', () => {
          activeClientId = clientId
          resolve()
        })
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load PayPal SDK'))
        })
      })
    }

    if (existingScript.dataset.clientId === clientId && window.paypal) {
      activeClientId = clientId
      return Promise.resolve()
    }
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'paypal-sdk-script'
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`
    script.async = true
    script.dataset.clientId = clientId
    script.onload = () => {
      activeClientId = clientId
      scriptLoadPromise = null
      resolve()
    }
    script.onerror = () => {
      scriptLoadPromise = null
      reject(new Error('Failed to load PayPal SDK'))
    }
    document.body.appendChild(script)
  })

  return scriptLoadPromise
}

export default function PayPalCheckout({
  orderId,
  clientId,
  onApprove,
  onError,
  onCancel,
  disabled = false,
  className = ''
}: PayPalCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sdkLoading, setSdkLoading] = useState(false)

  useEffect(() => {
    let isActive = true
    let buttons: PayPalButtons | null = null

    const renderButtons = async () => {
      if (!containerRef.current) {
        return
      }

      if (disabled) {
        return
      }

      try {
        setSdkLoading(true)
        await loadPayPalScript(clientId)

        if (!isActive || !window.paypal || !containerRef.current) {
          return
        }

        containerRef.current.innerHTML = ''

        buttons = window.paypal.Buttons({
          createOrder: () => orderId,
          onApprove: async (data) => {
            try {
              await onApprove(data.orderID)
            } catch (error) {
              onError(error instanceof Error ? error.message : 'Payment failed')
            }
          },
          onCancel: () => {
            onCancel?.()
          },
          onError: (error) => {
            const message = error instanceof Error ? error.message : 'Unable to complete PayPal checkout'
            onError(message)
          },
          style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'paypal',
            height: 45
          }
        })

        buttons.render(containerRef.current)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load PayPal checkout'
        onError(message)
      } finally {
        if (isActive) {
          setSdkLoading(false)
        }
      }
    }

    renderButtons()

    return () => {
      isActive = false
      if (buttons) {
        buttons.close()
      }
    }
  }, [clientId, onApprove, onCancel, onError, disabled, orderId])

  if (disabled) {
    return null
  }

  return (
    <div className={className}>
      {sdkLoading && (
        <div className="mb-2 text-sm text-gray-600">Loading PayPal checkout...</div>
      )}
      <div ref={containerRef} className="min-h-[52px]" />
    </div>
  )
}
