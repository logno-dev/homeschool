import { randomUUID } from 'crypto'
import { eq, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createFamily, createUser } from '@/lib/database'
import { authAccounts, children, families, guardians, users } from '@/lib/schema'
import { createAuthAccountForUser, normalizeEmail } from '@/lib/auth-server'
import { getGlobalSetting } from '@/lib/database'
import { sendPendingActivationEmail, sendRegistrationNotificationEmail } from '@/lib/email'
import { getHandbookSettings, recordAcknowledgement, type ReleaseChoice } from '@/lib/acknowledgements'

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      releaseLiabilityAgreed,
      contactInfoRelease,
      photographyRelease,
       handbookAgreed,
       familyMode = 'create',
       familyName,
       familyAddress,
       familyPhone,
       familyCode,
       familyChildren = []
    } = await request.json()

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'First name, last name, email, and password are required' }, { status: 400 })
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (releaseLiabilityAgreed !== true || handbookAgreed !== true) {
      return NextResponse.json({ error: 'You must agree to the release of liability and handbook acknowledgement' }, { status: 400 })
    }

    if (!['agree', 'do_not_agree'].includes(contactInfoRelease) || !['agree', 'do_not_agree'].includes(photographyRelease)) {
      return NextResponse.json({ error: 'Please select an option for each contact and photography release' }, { status: 400 })
    }

    const handbook = await getHandbookSettings()
    if (!handbook.url || !handbook.version) {
      return NextResponse.json({ error: 'The current handbook has not been configured. Please contact an administrator.' }, { status: 503 })
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

    let familyId: string
    if (familyMode === 'join') {
      const [family] = await db.select({ id: families.id }).from(families).where(eq(families.sharingCode, String(familyCode || '').trim().toUpperCase())).limit(1)
      if (!family) return NextResponse.json({ error: 'Family code not found' }, { status: 400 })
      familyId = family.id
    } else if (familyMode === 'create') {
      if (!String(familyName || '').trim() || !String(familyAddress || '').trim() || !String(familyPhone || '').trim()) return NextResponse.json({ error: 'Family name, address, and phone are required' }, { status: 400 })
      if (!Array.isArray(familyChildren) || familyChildren.some((child) => !child || typeof child !== 'object' || !String(child.firstName || '').trim() || !String(child.lastName || '').trim() || !String(child.dateOfBirth || '').trim() || !String(child.grade || '').trim())) return NextResponse.json({ error: 'Each child requires a first name, last name, date of birth, and grade' }, { status: 400 })
      const family = await createFamily({ name: String(familyName).trim(), address: String(familyAddress).trim(), phone: String(familyPhone).trim(), email: normalizedEmail })
      familyId = family.id
      for (const child of familyChildren) await db.insert(children).values({ id: randomUUID(), familyId, firstName: String(child.firstName).trim(), lastName: String(child.lastName).trim(), dateOfBirth: String(child.dateOfBirth), grade: String(child.grade).trim(), gradeYear: null, gradeLevel: null, allergies: null, medicalNotes: null })
    } else return NextResponse.json({ error: 'Choose whether to create or join a family' }, { status: 400 })

    const user = await createUser({
      id: randomUUID(),
      email: normalizedEmail,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      role: 'user',
      activationStatus: 'pending',
       familyId,
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
    await db.insert(guardians).values({ id: user.id, email: normalizedEmail, firstName: String(firstName).trim(), lastName: String(lastName).trim(), role: 'user', familyId, isMainContact: familyMode === 'create', phone: familyMode === 'create' ? String(familyPhone).trim() : null })

    await recordAcknowledgement({
      userId: user.id,
      releaseLiabilityAgreed,
      contactInfoRelease: contactInfoRelease as ReleaseChoice,
      photographyRelease: photographyRelease as ReleaseChoice,
      handbookVersion: handbook.version
    })

    try {
      await sendPendingActivationEmail({ to: user.email, firstName: user.firstName })
    } catch (emailError) {
      console.error('Unable to send pending activation email:', emailError)
    }

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
