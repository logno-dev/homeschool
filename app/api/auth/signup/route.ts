import { randomUUID } from 'crypto'
import { eq, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createUser } from '@/lib/database'
import { authAccounts, users } from '@/lib/schema'
import { createAuthAccountForUser, normalizeEmail } from '@/lib/auth-server'
import { getGlobalSetting } from '@/lib/database'
import { sendRegistrationNotificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json()

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'First name, last name, email, and password are required' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const normalizedEmail = normalizeEmail(email)

    const [existingAccount] = await db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(eq(authAccounts.email, normalizedEmail))
      .limit(1)

    if (existingAccount) {
      return NextResponse.json({ error: 'An account already exists for this email' }, { status: 409 })
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, normalizedEmail), eq(users.email, email)))
      .limit(1)

    if (existingUser) {
      return NextResponse.json(
        { error: 'An internal user record already exists for this email. Ask an admin to run user migration.' },
        { status: 409 }
      )
    }

    const user = await createUser({
      id: randomUUID(),
      email: normalizedEmail,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      role: 'user',
      activationStatus: 'pending',
      familyId: null,
      dateOfBirth: null,
      grade: null,
      emergencyContact: null
    })

    await createAuthAccountForUser({
      userId: user.id,
      email: normalizedEmail,
      password,
      mustResetPassword: false,
      isActive: false
    })

    const notificationRecipients = (await getGlobalSetting('registration_notification_emails'))
      ?.split(',')
      .map((recipient) => recipient.trim())
      .filter(Boolean) || []

    if (notificationRecipients.length) {
      try {
        await sendRegistrationNotificationEmail({
          recipients: notificationRecipients,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        })
      } catch (notificationError) {
        console.error('Unable to send registration notification:', notificationError)
      }
    }

    const response = NextResponse.json({
      message: 'Account created. An administrator must approve your account before you can sign in.',
      pendingActivation: true
    }, { status: 201 })

    return response
  } catch (error) {
    console.error('Error signing up:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
