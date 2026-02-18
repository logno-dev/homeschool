import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'crypto'
import { and, eq, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { authAccounts, authSessions, guardians, users } from '@/lib/schema'

export const SESSION_COOKIE_NAME = 'dvclc_session'
const SESSION_TTL_DAYS = 14
const RESET_TTL_MINUTES = 60

type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
}

export type AppAuthSession = {
  user: SessionUser
  role?: string
  roles?: string[]
}

function nowIso() {
  return new Date().toISOString()
}

function getId() {
  return typeof randomUUID === 'function'
    ? randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(':')
  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false
  }

  const candidate = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(hash, 'hex')
  if (candidate.length !== storedBuffer.length) {
    return false
  }

  return timingSafeEqual(candidate, storedBuffer)
}

export async function createAuthAccountForUser(input: {
  userId: string
  email: string
  password: string
  mustResetPassword?: boolean
}) {
  const email = normalizeEmail(input.email)
  const createdAt = nowIso()
  const passwordHash = hashPassword(input.password)

  const result = await db
    .insert(authAccounts)
    .values({
      id: getId(),
      userId: input.userId,
      email,
      passwordHash,
      mustResetPassword: Boolean(input.mustResetPassword),
      isActive: true,
      createdAt,
      updatedAt: createdAt
    })
    .returning()

  return result[0]
}

export async function authenticateWithPassword(email: string, password: string) {
  const normalized = normalizeEmail(email)
  const accountRows = await db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.email, normalized), eq(authAccounts.isActive, true)))
    .limit(1)

  const account = accountRows[0]
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return null
  }

  await db
    .update(authAccounts)
    .set({
      lastLoginAt: nowIso(),
      updatedAt: nowIso()
    })
    .where(eq(authAccounts.id, account.id))

  return account
}

export async function changePasswordForUser(input: {
  userId: string
  currentPassword: string
  nextPassword: string
}) {
  const [account] = await db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, input.userId), eq(authAccounts.isActive, true)))
    .limit(1)

  if (!account) {
    return { ok: false as const, error: 'Account not found' }
  }

  if (!verifyPassword(input.currentPassword, account.passwordHash)) {
    return { ok: false as const, error: 'Current password is incorrect' }
  }

  await db
    .update(authAccounts)
    .set({
      passwordHash: hashPassword(input.nextPassword),
      mustResetPassword: false,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      updatedAt: nowIso()
    })
    .where(eq(authAccounts.id, account.id))

  await deleteAllUserSessions(account.userId)

  return { ok: true as const }
}

export async function createSessionForUser(userId: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(authSessions).values({
    id: getId(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: expiresAt.toISOString(),
    createdAt: nowIso()
  })

  return { token, expiresAt }
}

export function setSessionCookie(response: Response, token: string, expiresAt: Date) {
  const isProduction = process.env.NODE_ENV === 'production'
  // NextResponse extends Response and supports cookies.
  ;(response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } }).cookies?.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    expires: expiresAt
  })
}

export function clearSessionCookie(response: Response) {
  ;(response as Response & { cookies?: { set: (options: Record<string, unknown>) => void } }).cookies?.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0)
  })
}

export async function deleteSessionByToken(token: string) {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)))
}

export async function deleteAllUserSessions(userId: string) {
  await db.delete(authSessions).where(eq(authSessions.userId, userId))
}

async function buildSessionFromUserId(userId: string): Promise<AppAuthSession | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) {
    return null
  }

  const [guardian] = await db.select().from(guardians).where(eq(guardians.id, user.id)).limit(1)
  const role = guardian?.role || user.role || 'user'

  return {
    user: {
      id: user.id,
      email: guardian?.email || user.email,
      firstName: guardian?.firstName || user.firstName,
      lastName: guardian?.lastName || user.lastName
    },
    role,
    roles: [role]
  }
}

export async function getSessionFromToken(token: string): Promise<AppAuthSession | null> {
  const [sessionRow] = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, hashToken(token)))
    .limit(1)

  if (!sessionRow) {
    return null
  }

  if (new Date(sessionRow.expiresAt) <= new Date()) {
    await db.delete(authSessions).where(eq(authSessions.id, sessionRow.id))
    return null
  }

  return buildSessionFromUserId(sessionRow.userId)
}

export async function getCurrentAuthSession(): Promise<AppAuthSession | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    return null
  }

  return getSessionFromToken(token)
}

export async function createPasswordResetToken(email: string) {
  const normalized = normalizeEmail(email)
  const [account] = await db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.email, normalized), eq(authAccounts.isActive, true)))
    .limit(1)

  if (!account) {
    return null
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString()

  await db
    .update(authAccounts)
    .set({
      resetTokenHash: hashToken(token),
      resetTokenExpiresAt: expiresAt,
      updatedAt: nowIso()
    })
    .where(eq(authAccounts.id, account.id))

  return token
}

export async function resetPasswordFromToken(token: string, nextPassword: string) {
  const now = nowIso()
  const [account] = await db
    .select()
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.resetTokenHash, hashToken(token)),
        gt(authAccounts.resetTokenExpiresAt, now),
        eq(authAccounts.isActive, true)
      )
    )
    .limit(1)

  if (!account) {
    return null
  }

  await db
    .update(authAccounts)
    .set({
      passwordHash: hashPassword(nextPassword),
      mustResetPassword: false,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      updatedAt: nowIso()
    })
    .where(eq(authAccounts.id, account.id))

  await deleteAllUserSessions(account.userId)

  return account
}
