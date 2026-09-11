import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'

const require = createRequire(import.meta.url)
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-09-10T19:00:00Z'])) }
}
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, {
    module, exports: module.exports, console, Date: FixedDate,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  })
  return module.exports
}

const schema = load('lib/schema.ts')
const client = createClient({ url: ':memory:' })
const db = drizzle(client, { schema })
try {
  // Build isolated test tables from the real column definitions.
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.users, schema.guardians, schema.userGroups, schema.userGroupMemberships, schema.sessions, schema.sessionRegistrationWindows, schema.events]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.map(column => {
      let definition = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}`
      if (column.default !== undefined) {
        const value = column.default
        const sql = typeof value === 'object' ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : Number(value)
        definition += ` DEFAULT ${sql}`
      }
      return definition
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }
  const time = load('lib/app-time.ts', { 'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/timezones': {} })
  const appTime = { ...time, getAppTimezone: async () => 'America/Los_Angeles' }
  const groups = load('lib/user-groups.ts', {
    'server-only': {}, '@/lib/db': { db }, '@/lib/schema': schema, '@/lib/app-time': appTime,
    '@/lib/admin-access': load('lib/admin-access.ts'),
  })
  const people = [
    ['parent', 'family-a'], ['teacher', 'family-a'], ['user-only', 'family-a'],
    ['outsider', 'family-b'], ['unattached', null], ['non-guardian', 'family-a'],
  ]
  for (const [id, familyId] of people) {
    await db.insert(schema.users).values({ id, familyId, email: `${id}@example.com`, firstName: id, lastName: 'Test' })
    if (['parent', 'teacher', 'outsider'].includes(id)) await db.insert(schema.guardians).values({ id, familyId, email: `${id}@example.com`, firstName: id, lastName: 'Test' })
  }
  await db.insert(schema.userGroups).values([
    { id: 'family', name: 'Family', slug: 'family' },
    { id: 'teacher', name: 'Teacher', slug: 'teacher', accessControls: '{"reports":true}' },
    { id: 'custom', name: 'Setup Crew', slug: 'setup-crew' },
    { id: 'unrelated', name: 'Other Group', slug: 'other' },
  ])
  await db.insert(schema.userGroupMemberships).values([
    { id: 'm1', userId: 'parent', groupId: 'family' },
    { id: 'm2', userId: 'teacher', groupId: 'family' },
    { id: 'm3', userId: 'teacher', groupId: 'teacher' },
    { id: 'm4', userId: 'teacher', groupId: 'custom' },
    { id: 'm5', userId: 'non-guardian', groupId: 'unrelated' },
    { id: 'm6', userId: 'outsider', groupId: 'family' },
    { id: 'm7', userId: 'unattached', groupId: 'custom' },
  ])
  await db.insert(schema.sessions).values({ id: 'session', name: 'Fall', startDate: '2026-10-01', endDate: '2026-12-01', registrationStartDate: '2026-10-01', registrationEndDate: '2026-12-01' })
  await db.insert(schema.sessionRegistrationWindows).values([
    { id: 'family-window', sessionId: 'session', groupId: 'family', startDate: '2026-09-20', endDate: '2026-09-30' },
    { id: 'teacher-window', sessionId: 'session', groupId: 'teacher', startDate: '2026-09-10T12:00', endDate: '2026-09-11T12:00' },
    { id: 'custom-window', sessionId: 'session', groupId: 'custom', startDate: '2026-09-12', endDate: '2026-09-15' },
    { id: 'unrelated-window', sessionId: 'session', groupId: 'unrelated', startDate: '2026-09-01', endDate: '2026-09-30' },
  ])

  for (const id of ['parent', 'teacher', 'user-only']) {
    const access = await groups.getRegistrationAccess('session', id)
    assert.equal(access.isOpen, true, `${id} inherits the teacher window at its exact opening time`)
    assert.equal(access.group.id, 'teacher')
    assert.equal(access.windows.length, 3, 'Shared memberships are deduplicated and non-guardian groups excluded')
  }
  assert.equal((await groups.getRegistrationAccess('session', 'outsider')).isOpen, false)
  assert.equal(await groups.getAdminModuleAccess('parent', 'reports'), false, 'Admin access stays personal')
  assert.equal(await groups.getAdminModuleAccess('teacher', 'reports'), true)
  assert.equal(await groups.userBelongsToGroup('parent', 'teacher'), false, 'Registration inheritance does not change actual membership')
  assert.equal((await groups.getRegistrationAccess('missing-session', 'parent')).session, null)
  assert.equal((await groups.getRegistrationAccess('session', 'unknown-user')).isOpen, false)

  await db.update(schema.sessionRegistrationWindows).set({ startDate: '2026-09-01', endDate: '2026-09-09' }).where(eq(schema.sessionRegistrationWindows.id, 'teacher-window'))
  const upcoming = await groups.getRegistrationAccess('session', 'parent')
  assert.equal(upcoming.isOpen, false)
  assert.equal(upcoming.group.id, 'custom', 'Earliest upcoming family window wins over a later personal window')
  assert.match(upcoming.reason, /9\/12\/2026/)
  await db.update(schema.sessionRegistrationWindows).set({ startDate: '2026-09-10', endDate: '2026-09-10T12:00' }).where(eq(schema.sessionRegistrationWindows.id, 'custom-window'))
  assert.equal((await groups.getRegistrationAccess('session', 'parent')).group.id, 'custom')
  assert.equal((await groups.getRegistrationAccess('session', 'parent')).isOpen, true, 'All custom groups inherit access, inclusive of the closing instant')
  assert.equal((await groups.getRegistrationAccess('session', 'unattached')).isOpen, true, 'Users without a family retain their own window access')

  const calendar = load('lib/events.ts', { '@/lib/db': { db, client }, '@/lib/schema': schema, '@/lib/app-time': appTime, '@/lib/user-groups': groups })
  const calendarEvents = await calendar.fetchCalendarEvents('parent')
  assert.ok(calendarEvents.some(event => event.id === 'registration-open-custom-window'))
  assert.ok(calendarEvents.some(event => event.id === 'registration-open-teacher-window'))
  assert.ok(!calendarEvents.some(event => event.id === 'registration-open-unrelated-window'))

  await db.update(schema.guardians).set({ familyId: 'family-b' }).where(eq(schema.guardians.id, 'teacher'))
  assert.equal((await groups.getRegistrationAccess('session', 'parent')).isOpen, false, 'Moving a guardian out removes inherited access immediately')
  await db.update(schema.guardians).set({ familyId: 'family-a' }).where(eq(schema.guardians.id, 'teacher'))
  await db.delete(schema.userGroupMemberships).where(eq(schema.userGroupMemberships.id, 'm4'))
  assert.equal((await groups.getRegistrationAccess('session', 'parent')).isOpen, false, 'Removing group membership removes inherited access immediately')
  assert.equal((await db.select().from(schema.userGroupMemberships).where(eq(schema.userGroupMemberships.userId, 'parent'))).length, 1)
  console.log('Family-wide Teacher/custom windows, boundaries, upcoming dates, calendar visibility, family isolation, and personal admin permissions verified.')
} finally { client.close() }
