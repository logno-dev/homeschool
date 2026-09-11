// An empty list means anyone may sign up. Malformed restrictions fail closed.
export function parseVolunteerJobGroups(value: string | null | undefined): string[] | null {
  if (value == null) return []
  try {
    const groups: unknown = JSON.parse(value)
    return Array.isArray(groups) && groups.every(id => typeof id === 'string' && id.length > 0) ? [...new Set(groups)] : null
  } catch { return null }
}

export function volunteerJobAllowsGroups(restrictions: string | null | undefined, userGroupIds: ReadonlySet<string>): boolean {
  const allowed = parseVolunteerJobGroups(restrictions)
  return allowed !== null && (allowed.length === 0 || allowed.some(id => userGroupIds.has(id)))
}
