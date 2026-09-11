import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { eq } from 'drizzle-orm'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, setTimeout, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}

const directory = mkdtempSync(join(tmpdir(), 'dvclc-volunteer-capacity-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })
let viewerId = 'guardian-b'
try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.guardians, schema.sessions, schema.schedules, schema.classTeachingRequests, schema.volunteerAssignments, schema.familyRegistrationStatus, schema.familySessionFees, schema.children, schema.classRegistrations]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.map(column => {
      let sql = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}`
      if (column.default !== undefined) {
        const value = column.default
        sql += ` DEFAULT ${typeof value === 'object' ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : Number(value)}`
      }
      return sql
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }
  for (const [id, familyId] of [['guardian-a', 'family-a'], ['guardian-b', 'family-b'], ['guardian-c', 'family-c'], ['guardian-b2', 'family-b']]) {
    await db.insert(schema.guardians).values({ id, familyId, email: `${id}@example.com`, firstName: id, lastName: 'Test' })
  }
  await db.insert(schema.sessions).values({ id: 'session', name: 'Test', startDate: '2026-09-01', endDate: '2026-12-01', registrationStartDate: '2026-09-01', registrationEndDate: '2026-12-01' })
  await db.insert(schema.classTeachingRequests).values({ id: 'class', sessionId: 'session', guardianId: null, teacherName: 'Guest', className: 'Two-helper class', description: 'Test', gradeRange: '1-3', helpersNeeded: 2, status: 'approved' })
  await db.insert(schema.schedules).values({ id: 'schedule', sessionId: 'session', classTeachingRequestId: 'class', classroomId: 'room', sessionClassroomId: 'room', period: 'second', status: 'published' })
  const currentSession = () => ({ user: { id: viewerId } })
  const mocks = {
    '@/lib/db': { db }, '@/lib/schema': schema,
    '@/lib/server-auth': { getAuthenticatedUser: async () => currentSession(), getAuthenticatedUserSession: async () => ({ session: currentSession() }) },
    '@/lib/database': { getGuardianById: async id => (await db.select().from(schema.guardians).where(eq(schema.guardians.id, id)))[0], getGlobalSetting: async () => null },
    '@/lib/fee-calculation': { createOrUpdateFamilySessionFee: async () => {} },
    '@/lib/grades': { isGradeWithinRange: () => true },
    '@/lib/registration-events': { publishRegistrationUpdate: () => {} },
    '@/lib/user-groups': { getRegistrationAccess: async () => ({ isOpen: true }) },
    '@/lib/email': { sendRegistrationConfirmationEmail: async () => {}, sendRegistrationOverrideNotificationEmail: async () => {} },
  }
  const hold = load('app/api/registration/holds/volunteer/route.ts', mocks).POST
  const submit = load('app/api/registration/batch-register/route.ts', mocks).POST
  const request = body => new Request('http://localhost/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const selection = () => ({ sessionId: 'session', guardianId: viewerId, period: 'second', volunteerType: 'helper', scheduleId: 'schedule', className: 'Two-helper class', guardianName: viewerId })
  const submitVolunteer = () => submit(request({ sessionId: 'session', registrations: [], volunteerAssignments: [selection()] }))
  const insertAssignment = (id, guardianId, familyId, status, extras = {}) => db.insert(schema.volunteerAssignments).values({ id, guardianId, familyId, sessionId: 'session', scheduleId: 'schedule', period: 'second', volunteerType: 'helper', status, ...extras })
  const future = new Date(Date.now() + 3600000).toISOString()
  const past = new Date(Date.now() - 3600000).toISOString()

  // Reproduce the reported flow: one confirmed helper + the second helper's cart hold.
  await insertAssignment('confirmed-a', 'guardian-a', 'family-a', 'assigned')
  let response = await hold(request(selection()))
  assert.equal(response.status, 200)
  const held = await response.json()
  assert.ok(held.holdId)
  response = await submitVolunteer()
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
  let rows = await db.select().from(schema.volunteerAssignments)
  assert.equal(rows.length, 2, 'Confirmation reuses the held row rather than inserting a duplicate')
  assert.equal(rows.find(row => row.id === held.holdId).status, 'assigned')
  assert.equal(rows.find(row => row.id === held.holdId).holdExpiresAt, null)

  viewerId = 'guardian-c'
  assert.equal((await hold(request(selection()))).status, 409, 'A third helper cannot reserve a full class')
  assert.equal((await submitVolunteer()).status, 409, 'A third helper cannot bypass capacity by submitting directly')

  // Another guardian's hold still occupies a spot, including within the same family.
  await db.delete(schema.volunteerAssignments)
  await insertAssignment('confirmed-a', 'guardian-a', 'family-a', 'assigned')
  await insertAssignment('other-family-hold', 'guardian-b2', 'family-b', 'hold', { holdExpiresAt: future })
  viewerId = 'guardian-b'
  assert.equal((await hold(request(selection()))).status, 409)
  assert.equal((await submitVolunteer()).status, 409)

  // Pending approval occupies a spot; an expired hold does not.
  await db.delete(schema.volunteerAssignments)
  await insertAssignment('pending-a', 'guardian-a', 'family-a', 'pending')
  await insertAssignment('expired-b', 'guardian-b', 'family-b', 'hold', { holdExpiresAt: past })
  assert.equal((await hold(request(selection()))).status, 200)
  assert.equal((await submitVolunteer()).status, 200)
  rows = await db.select().from(schema.volunteerAssignments)
  assert.equal(rows.filter(row => row.status === 'assigned' || row.status === 'pending').length, 2)

  // A hold for a different volunteer role is not a helper reservation.
  await db.delete(schema.volunteerAssignments)
  await insertAssignment('co-teacher-hold', 'guardian-b', 'family-b', 'hold', { holdExpiresAt: future, volunteerType: 'co_teacher' })
  assert.equal((await submitVolunteer()).status, 409)
  assert.equal((await db.select().from(schema.volunteerAssignments))[0].status, 'hold')

  // Legacy numeric period values must confirm the same hold, not consume another slot.
  await db.delete(schema.volunteerAssignments)
  await insertAssignment('confirmed-a', 'guardian-a', 'family-a', 'assigned')
  await insertAssignment('numeric-hold', 'guardian-b', 'family-b', 'hold', { holdExpiresAt: future, period: '2' })
  assert.equal((await submitVolunteer()).status, 200)
  rows = await db.select().from(schema.volunteerAssignments)
  assert.equal(rows.length, 2)
  assert.equal(rows.find(row => row.id === 'numeric-hold').period, 'second')
  console.log('Two-helper checkout, held-row reuse, full-class rejection, other-guardian holds, pending/expired holds, and role/period matching checks passed.')
} finally {
  client.close()
  rmSync(directory, { recursive: true, force: true })
}
