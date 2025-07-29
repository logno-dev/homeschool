import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sessionFeeConfigs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin or moderator
    const roleResponse = await fetch(`${process.env.AUTH_API_URL}/api/user/${session.user.id}/role`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.AUTH_API_KEY!,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!roleResponse.ok) {
      return NextResponse.json({ error: 'Failed to verify user role' }, { status: 403 })
    }

    const roleData = await roleResponse.json()
    if (!['admin', 'moderator'].includes(roleData.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { sessionId } = params

    const feeConfig = await db
      .select()
      .from(sessionFeeConfigs)
      .where(eq(sessionFeeConfigs.sessionId, sessionId))
      .limit(1)

    return NextResponse.json({
      success: true,
      feeConfig: feeConfig.length > 0 ? feeConfig[0] : null
    })

  } catch (error) {
    console.error('Error fetching session fee config:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin or moderator
    const roleResponse = await fetch(`${process.env.AUTH_API_URL}/api/user/${session.user.id}/role`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.AUTH_API_KEY!,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!roleResponse.ok) {
      return NextResponse.json({ error: 'Failed to verify user role' }, { status: 403 })
    }

    const roleData = await roleResponse.json()
    if (!['admin', 'moderator'].includes(roleData.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { sessionId } = params
    const body = await request.json()
    const { firstChildFee, additionalChildFee, dueDate } = body

    // Validate input
    if (typeof firstChildFee !== 'number' || firstChildFee < 0) {
      return NextResponse.json({ 
        error: 'First child fee must be a non-negative number' 
      }, { status: 400 })
    }

    if (typeof additionalChildFee !== 'number' || additionalChildFee < 0) {
      return NextResponse.json({ 
        error: 'Additional child fee must be a non-negative number' 
      }, { status: 400 })
    }

    if (!dueDate || isNaN(Date.parse(dueDate))) {
      return NextResponse.json({ 
        error: 'Valid due date is required' 
      }, { status: 400 })
    }

    // Check if fee config already exists
    const existingConfig = await db
      .select()
      .from(sessionFeeConfigs)
      .where(eq(sessionFeeConfigs.sessionId, sessionId))
      .limit(1)

    if (existingConfig.length > 0) {
      // Update existing config
      await db
        .update(sessionFeeConfigs)
        .set({
          firstChildFee,
          additionalChildFee,
          dueDate,
          updatedAt: new Date().toISOString()
        })
        .where(eq(sessionFeeConfigs.sessionId, sessionId))

      return NextResponse.json({
        success: true,
        message: 'Fee configuration updated successfully'
      })
    } else {
      // Create new config
      const configId = randomUUID()
      await db
        .insert(sessionFeeConfigs)
        .values({
          id: configId,
          sessionId,
          firstChildFee,
          additionalChildFee,
          dueDate
        })

      return NextResponse.json({
        success: true,
        message: 'Fee configuration created successfully'
      })
    }

  } catch (error) {
    console.error('Error saving session fee config:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}