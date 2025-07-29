import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if required environment variables are set
    if (!process.env.AUTH_API_URL || !process.env.AUTH_API_KEY || !process.env.AUTH_APP_ID) {
      console.error('Missing required environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    console.log('Password reset request for email:', email)

    const requestBody = {
      email,
      appId: process.env.AUTH_APP_ID,
    }

    console.log('Request body:', requestBody)

    // Call external auth service for password reset with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let response
    try {
      response = await fetch(`${process.env.AUTH_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.AUTH_API_KEY!,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('Fetch error:', fetchError)
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout - authentication service is not responding' },
          { status: 504 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to connect to authentication service' },
        { status: 503 }
      )
    }
    
    clearTimeout(timeoutId)

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    // Check if response is JSON
    const contentType = response.headers.get('content-type')
    let data
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
      console.log('Response data:', data)
    } else {
      // If not JSON, get text response for debugging
      const textResponse = await response.text()
      console.log('Non-JSON response:', textResponse)
      
      return NextResponse.json(
        { error: 'Invalid response from authentication service' },
        { status: 500 }
      )
    }

    if (!response.ok) {
      console.error('Password reset request failed:', data)
      return NextResponse.json(
        { error: data.error || data.message || 'Password reset request failed' },
        { status: response.status }
      )
    }

    return NextResponse.json(
      { 
        message: 'Password reset email sent successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}