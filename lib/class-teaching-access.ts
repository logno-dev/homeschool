import 'server-only'

import { inArray } from 'drizzle-orm'
import { db } from './db'
import { userGroups } from './schema'
import { isClassTeachingAccessMode, parseClassTeachingGroupIds } from './class-teaching'

export async function validateClassTeachingAccessSettings(modeValue: unknown, groupIdsValue: unknown) {
  if (!isClassTeachingAccessMode(modeValue)) return { error: 'Choose a valid class-teaching access state' } as const
  const groupIds = parseClassTeachingGroupIds(groupIdsValue)
  if (modeValue === 'selected_groups') {
    if (groupIds.length === 0) return { error: 'Select at least one user group for limited access' } as const
    const existing = await db.select({ id: userGroups.id }).from(userGroups).where(inArray(userGroups.id, groupIds))
    if (existing.length !== groupIds.length) return { error: 'One or more selected user groups no longer exist' } as const
  }
  return { mode: modeValue, groupIds, serializedGroupIds: JSON.stringify(groupIds) } as const
}
