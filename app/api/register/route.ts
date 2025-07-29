import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { email, password, confirmPassword, firstName, lastName, appId } = body
    
    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    console.log('Registration request received:', { 
      email, 
      firstName, 
      lastName 
    })

    const requestBody = {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      appId: appId || process.env.AUTH_APP_ID, // Use client appId if provided, fallback to server
    }

    console.log('Request body:', { ...requestBody, password: '[REDACTED]' })

    // Call external auth service for registration with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let response
    try {
      response = await fetch(`${process.env.AUTH_API_URL}/api/auth/register`, {
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
      console.error('Registration failed:', data)
      return NextResponse.json(
        { error: data.error || data.message || 'Registration failed' },
        { status: response.status }
      )
    }

    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: data.user
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}