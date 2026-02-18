import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createUser } from '@/lib/database'
import { createAuthAccountForUser, normalizeEmail } from '@/lib/auth-server'
import { authAccounts, guardians, users } from '@/lib/schema'
import { getAuthenticatedAdmin } from '@/lib/server-auth'

function makeTemporaryPassword() {
  return randomBytes(9).toString('base64url')
}

export async function POST() {
  try {
    const auth = await getAuthenticatedAdmin()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const migrated: Array<{ userId: string; email: string; temporaryPassword: string }> = []

    const allGuardians = await db.select().from(guardians)
    for (const guardian of allGuardians) {
      const [existingUser] = await db.select().from(users).where(eq(users.id, guardian.id)).limit(1)
      if (!existingUser) {
        await createUser({
          id: guardian.id,
          email: normalizeEmail(guardian.email),
          firstName: guardian.firstName,
          lastName: guardian.lastName,
          role: guardian.role,
          familyId: guardian.familyId,
          dateOfBirth: null,
          grade: null,
          emergencyContact: null
        })
      }

      const [existingAccount] = await db.select().from(authAccounts).where(eq(authAccounts.userId, guardian.id)).limit(1)
      if (!existingAccount) {
        const temporaryPassword = makeTemporaryPassword()
        await createAuthAccountForUser({
          userId: guardian.id,
          email: normalizeEmail(guardian.email),
          password: temporaryPassword,
          mustResetPassword: true
        })
        migrated.push({ userId: guardian.id, email: normalizeEmail(guardian.email), temporaryPassword })
      }
    }

    const allUsers = await db.select().from(users)
    for (const user of allUsers) {
      const [existingAccount] = await db.select().from(authAccounts).where(eq(authAccounts.userId, user.id)).limit(1)
      if (!existingAccount && user.email) {
        const temporaryPassword = makeTemporaryPassword()
        await createAuthAccountForUser({
          userId: user.id,
          email: normalizeEmail(user.email),
          password: temporaryPassword,
          mustResetPassword: true
        })
        migrated.push({ userId: user.id, email: normalizeEmail(user.email), temporaryPassword })
      }
    }

    return NextResponse.json({
      message: 'Existing users migrated to local auth',
      migratedCount: migrated.length,
      migrated
    })
  } catch (error) {
    console.error('Error migrating users to local auth:', error)
    return NextResponse.json({ error: 'Failed to migrate users' }, { status: 500 })
  }
}
