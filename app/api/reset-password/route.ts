import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token, password, confirmPassword } = await request.json()

    // Validate required fields
    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Token, password, and confirmPassword are required' },
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

    console.log('Password reset confirmation for token:', token.substring(0, 10) + '...')

    const requestBody = {
      token,
      password,
      confirmPassword,
      appId: process.env.AUTH_APP_ID,
    }

    console.log('Request body:', { ...requestBody, password: '[REDACTED]' })

    // Call external auth service for password reset confirmation with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let response
    try {
      response = await fetch(`${process.env.AUTH_API_URL}/api/auth/reset-password`, {
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
      console.error('Password reset failed:', data)
      return NextResponse.json(
        { error: data.error || data.message || 'Password reset failed' },
        { status: response.status }
      )
    }

    return NextResponse.json(
      { 
        message: 'Password reset successfully'
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