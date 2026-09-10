import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@libsql/client'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, process: { env: { NODE_ENV: 'production' } }, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}

// Verify libSQL's in-place ALTER preserves foreign keys and dependent rows.
const client = createClient({ url: ':memory:' })
try {
  await client.executeMultiple(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE guardians(id TEXT PRIMARY KEY);
    INSERT INTO guardians VALUES ('real-teacher'), ('fallback');
    CREATE TABLE class_teaching_requests (
      id TEXT PRIMARY KEY, guardian_id TEXT NOT NULL, teacher_name TEXT, co_teacher_id TEXT,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    );
    CREATE TABLE schedules(id TEXT PRIMARY KEY, class_id TEXT REFERENCES class_teaching_requests(id) ON DELETE CASCADE);
    INSERT INTO class_teaching_requests VALUES ('linked', 'real-teacher', NULL, 'real-teacher'),
      ('write-in', 'fallback', 'Guest Instructor', 'real-teacher'), ('blank', 'real-teacher', '  ', NULL);
    INSERT INTO schedules VALUES ('schedule-1', 'linked'), ('schedule-2', 'write-in');
  `)
  await client.executeMultiple(readFileSync(new URL('../drizzle/0050_nullable_class_guardian.sql', import.meta.url), 'utf8'))
  const rows = (await client.execute('SELECT * FROM class_teaching_requests ORDER BY id')).rows
  assert.equal(rows.find(row => row.id === 'write-in').guardian_id, null)
  assert.equal(rows.find(row => row.id === 'write-in').co_teacher_id, 'real-teacher')
  assert.equal(rows.find(row => row.id === 'linked').guardian_id, 'real-teacher')
  assert.equal(rows.find(row => row.id === 'blank').guardian_id, 'real-teacher')
  assert.equal((await client.execute('SELECT * FROM schedules')).rows.length, 2)
  assert.equal((await client.execute('PRAGMA foreign_key_list(class_teaching_requests)')).rows[0].table, 'guardians')
  assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0)
  await client.execute("DELETE FROM guardians WHERE id='fallback'")
  assert.equal((await client.execute("SELECT * FROM class_teaching_requests WHERE id='write-in'")).rows.length, 1)
} finally { client.close() }

// Exercise real create/edit handlers with controlled data dependencies.
const schema = load('lib/schema.ts')
let stored = { id: 'class-1', guardianId: 'old-teacher', teacherName: null, coTeacherId: null }
const synced = []
const mocks = {
  '@/lib/schema': schema,
  '@/lib/server-auth': { getAuthenticatedAdmin: async () => ({ session: { user: { id: 'admin' } } }) },
  '@/lib/grades': { getGradeRangeFromLabel: () => ({ from: 1, to: 3 }) },
  '@/lib/user-groups': { syncTeacherGroupMembership: async id => synced.push(id) },
  '@/lib/database': {
    getGuardianById: async () => ({ id: 'admin' }),
    getClassTeachingRequestById: async () => ({ ...stored }),
    updateClassTeachingRequest: async (id, values) => (stored = { ...stored, ...values }),
  },
  '@/lib/db': { db: {
    select: () => ({ from: table => ({ where: condition => ({ limit: async () => {
      if (table === schema.sessions) return [{ id: 'session-1' }]
      // The selected teacher ID is the bound parameter in Drizzle's eq expression.
      const id = new SQLiteSyncDialect().sqlToQuery(condition).params[0]
      return id === 'real-teacher' ? [{ id, firstName: 'Real', lastName: 'Teacher' }] : []
    } }) }) }),
    insert: () => ({ values: values => ({ returning: async () => [values] }) }),
  } },
}
const create = load('app/api/admin/class-teaching-requests/route.ts', mocks).POST
const edit = load('app/api/admin/class-teaching-requests/[requestId]/route.ts', mocks).PATCH
const request = body => new Request('http://localhost/test', { method: 'POST', body: JSON.stringify(body) })
const base = { sessionId: 'session-1', className: 'Class', description: 'Description', gradeRange: '1-3' }
let response = await create(request({ ...base, teacherName: 'Guest Instructor' }))
assert.equal(response.status, 201)
assert.equal((await response.json()).request.guardianId, null, 'Write-in creation needs no guardian')
response = await create(request({ ...base, teacherId: 'real-teacher', teacherName: 'Stale placeholder' }))
assert.equal(response.status, 201)
const linked = (await response.json()).request
assert.equal(linked.guardianId, 'real-teacher')
assert.equal(linked.teacherName, null)
assert.equal((await create(request({ ...base, teacherId: 'missing-teacher' }))).status, 404)

const params = { params: Promise.resolve({ requestId: 'class-1' }) }
response = await edit(request({ teacherId: '', teacherName: 'Guest Instructor' }), params)
assert.equal(response.status, 200)
assert.equal(stored.guardianId, null)
assert.ok(synced.includes('old-teacher'), 'Old teacher group membership must be recalculated')
response = await edit(request({ teacherId: 'real-teacher', teacherName: '' }), params)
assert.equal(response.status, 200)
assert.equal(stored.guardianId, 'real-teacher')
assert.equal(stored.teacherName, null)
assert.equal((await edit(request({ teacherId: '', teacherName: '' }), params)).status, 400)
assert.ok(!synced.includes(null))

const published = [
  { schedule: { id: 'write-in-schedule' }, teacher: null, classTeachingRequest: { teacherName: 'Guest Instructor', maxStudents: 10, helpersNeeded: 1 } },
  { schedule: { id: 'linked-schedule' }, teacher: { id: 'real-teacher', firstName: 'Real', lastName: 'Teacher' }, classTeachingRequest: { teacherName: null, maxStudents: 10, helpersNeeded: 1 } },
]
const registrationSchedules = load('lib/registration-schedules.ts', {
  'server-only': {}, '@/lib/schema': schema,
  '@/lib/database': { ensureSessionClassrooms: async () => {}, ensureSessionVolunteerJobs: async () => {} },
  '@/lib/db': { db: { select: () => ({ from: table => {
    const query = {
      innerJoin: joinedTable => {
        assert.ok(table !== schema.schedules || joinedTable !== schema.guardians, 'Scheduled classes must not require a guardian join')
        return query
      },
      leftJoin: () => query,
      where: async () => table === schema.schedules ? published : [],
    }
    return query
  } }) } },
})
const scheduleResult = await registrationSchedules.getRegistrationSchedules('session-1')
assert.equal(scheduleResult.schedules.length, 2)
assert.equal(scheduleResult.schedules[0].teacher.id, null)
assert.equal(scheduleResult.schedules[0].teacher.firstName, 'Guest Instructor')
assert.equal(scheduleResult.schedules[1].teacher.id, 'real-teacher')
console.log('Nullable guardian migration, dependent-row preservation, write-in creation, and teacher reassignment checks passed.')
