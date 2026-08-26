import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { authAccounts, newsletterGroups, newsletterRecipients, userGroupMemberships, users } from '@/lib/schema'

export type NewsletterRecipient = {
  userId: string
  email: string
  firstName: string
  lastName: string
}

export async function resolveNewsletterRecipients(groupIds: string[], includeInactive: boolean): Promise<NewsletterRecipient[]> {
  if (!groupIds.length) return []

  const rows = await db
    .select({
      userId: users.id,
      userEmail: users.email,
      accountEmail: authAccounts.email,
      accountActive: authAccounts.isActive,
      firstName: users.firstName,
      lastName: users.lastName
    })
    .from(userGroupMemberships)
    .innerJoin(users, eq(userGroupMemberships.userId, users.id))
    .leftJoin(authAccounts, eq(authAccounts.userId, users.id))
    .where(inArray(userGroupMemberships.groupId, groupIds))

  const recipients = new Map<string, NewsletterRecipient>()
  for (const row of rows) {
    if (!includeInactive && row.accountActive !== true) continue
    const email = (row.accountEmail || row.userEmail || '').trim().toLowerCase()
    if (!email || recipients.has(row.userId)) continue
    recipients.set(row.userId, { userId: row.userId, email, firstName: row.firstName, lastName: row.lastName })
  }
  return [...recipients.values()].sort((a, b) => a.email.localeCompare(b.email))
}

export async function snapshotNewsletterRecipients(newsletterId: string, groupIds: string[], includeInactive: boolean) {
  const recipients = await resolveNewsletterRecipients(groupIds, includeInactive)
  await db.delete(newsletterRecipients).where(eq(newsletterRecipients.newsletterId, newsletterId))
  if (recipients.length) {
    await db.insert(newsletterRecipients).values(recipients.map((recipient) => ({
      id: randomUUID(),
      newsletterId,
      userId: recipient.userId,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    })))
  }
  return recipients.length
}

export async function getNewsletterGroupIds(newsletterId: string) {
  const rows = await db.select({ groupId: newsletterGroups.groupId }).from(newsletterGroups).where(eq(newsletterGroups.newsletterId, newsletterId))
  return rows.map((row) => row.groupId)
}
