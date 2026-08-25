import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getGlobalSetting } from '@/lib/database'
import { handbooks, userAcknowledgements } from '@/lib/schema'

export type ReleaseChoice = 'agree' | 'do_not_agree'

export async function getHandbookSettings() {
  const [activeHandbook] = await db
    .select({ url: handbooks.blobUrl, version: handbooks.version })
    .from(handbooks)
    .where(eq(handbooks.isActive, true))
    .limit(1)

  if (activeHandbook) {
    return activeHandbook
  }

  const [url, version] = await Promise.all([getGlobalSetting('handbook_url'), getGlobalSetting('handbook_version')])

  return { url: url || '', version: version || '' }
}

export async function hasCurrentAcknowledgement(userId: string) {
  const { version } = await getHandbookSettings()
  if (!version) {
    return true
  }

  const [acknowledgement] = await db
    .select({ handbookVersion: userAcknowledgements.handbookVersion })
    .from(userAcknowledgements)
    .where(eq(userAcknowledgements.userId, userId))
    .orderBy(desc(userAcknowledgements.acceptedAt))
    .limit(1)

  return acknowledgement?.handbookVersion === version
}

export async function recordAcknowledgement(input: {
  userId: string
  releaseLiabilityAgreed: boolean
  contactInfoRelease: ReleaseChoice
  photographyRelease: ReleaseChoice
  handbookVersion: string
}) {
  const now = new Date().toISOString()
  return db.insert(userAcknowledgements).values({
    id: randomUUID(),
    userId: input.userId,
    releaseLiabilityAgreed: input.releaseLiabilityAgreed,
    contactInfoRelease: input.contactInfoRelease,
    photographyRelease: input.photographyRelease,
    handbookVersion: input.handbookVersion,
    handbookAgreed: true,
    acceptedAt: now
  }).returning()
}
