import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createUser } from '@/lib/database'
import { authAccounts } from '@/lib/schema'
import { createAuthAccountForUser, createSessionForUser, normalizeEmail, setSessionCookie } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json()
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'First name, last name, email, and password are required' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const [existingAccount] = await db.select({ id: authAccounts.id }).from(authAccounts).limit(1)
    const bootstrapSecret = process.env.AUTH_BOOTSTRAP_SECRET
    const providedSecret = request.headers.get('x-bootstrap-secret')

    if (existingAccount && (!bootstrapSecret || providedSecret !== bootstrapSecret)) {
      return NextResponse.json({ error: 'Bootstrap is locked. Provide AUTH_BOOTSTRAP_SECRET to create another admin.' }, { status: 403 })
    }

    const normalizedEmail = normalizeEmail(email)
    const [emailInUse] = await db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(eq(authAccounts.email, normalizedEmail))
      .limit(1)

    if (emailInUse) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const user = await createUser({
      id: randomUUID(),
      email: normalizedEmail,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      role: 'admin',
      familyId: null,
      dateOfBirth: null,
      grade: null,
      emergencyContact: null
    })

    await createAuthAccountForUser({
      userId: user.id,
      email: normalizedEmail,
      password
    })

    const { token, expiresAt } = await createSessionForUser(user.id)
    const response = NextResponse.json({ message: 'Admin account created', userId: user.id }, { status: 201 })
    setSessionCookie(response, token, expiresAt)
    return response
  } catch (error) {
    console.error('Error bootstrapping admin:', error)
    return NextResponse.json({ error: 'Failed to bootstrap admin account' }, { status: 500 })
  }
}
