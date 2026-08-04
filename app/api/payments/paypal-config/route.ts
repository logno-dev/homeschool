import { NextResponse } from 'next/server'
import { getPayPalMetadata } from '@/lib/paypal'

export async function GET() {
  try {
    const { isSandbox } = getPayPalMetadata()

    return NextResponse.json({
      isSandbox,
      environment: isSandbox ? 'sandbox' : 'live'
    })
  } catch (error) {
    console.error('Error reading PayPal configuration:', error)
    return NextResponse.json({ error: 'Unable to read PayPal configuration' }, { status: 500 })
  }
}
