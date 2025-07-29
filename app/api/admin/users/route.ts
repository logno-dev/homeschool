import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    
    const { session } = auth

    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '50' // Get more users by default
    const role = searchParams.get('role') // Optional role filter

    // Build URL manually to ensure no unwanted parameters
    let authApiUrl = `${process.env.AUTH_API_URL}/api/users?page=${page}&limit=${limit}&appId=${process.env.AUTH_APP_ID}`

    // Only add role filter if it's a valid role value
    const validRoles = ['user', 'admin', 'moderator', 'member']
    if (role && validRoles.includes(role)) {
      authApiUrl += `&role=${role}`
    }



    // Fetch all users from auth API
    const usersResponse = await fetch(authApiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.AUTH_API_KEY!,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text()
      console.error('Auth API error:', usersResponse.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch users from auth service' },
        { status: usersResponse.status }
      )
    }

    const usersData = await usersResponse.json()
    return NextResponse.json({ 
      users: usersData.users || [],
      pagination: usersData.pagination || null
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

