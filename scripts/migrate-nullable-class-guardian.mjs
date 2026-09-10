import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
if (!process.env.DATABASE_URL || !process.env.DATABASE_AUTH_TOKEN) throw new Error('Database URL and token are required')
const url = new URL(process.env.DATABASE_URL)
url.searchParams.set('authToken', process.env.DATABASE_AUTH_TOKEN)

function sql(statement) {
  const result = spawnSync('turso', ['db', 'shell', '--', url.href, statement], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.replaceAll(process.env.DATABASE_AUTH_TOKEN, '[REDACTED]')
  // Some CLI SQL errors return exit status zero, so check the output as well.
  if (result.error || result.status !== 0 || /(^|\n)\s*Error:|SQLite error:/i.test(output)) throw new Error(output || 'Turso CLI failed')
  return output
}

function jsonQuery(statement) {
  const output = sql(statement)
  const json = output.split('\n').map(line => line.trim()).find(line => line.startsWith('[') || line.startsWith('{'))
  if (!json) throw new Error(`Expected a JSON result from Turso: ${output}`)
  return JSON.parse(json)
}

const classQuery = `SELECT json_group_array(json_object('id', id, 'guardianId', guardian_id, 'teacherName', teacher_name, 'coTeacherId', co_teacher_id, 'className', class_name)) AS data FROM (SELECT * FROM class_teaching_requests ORDER BY id)`
const dependencyTables = ['schedules', 'schedule_draft_entries', 'class_registrations', 'volunteer_assignments', 'class_material_charges', 'teacher_reimbursements']
const dependencyQuery = `SELECT json_group_array(json_object('table', source, 'id', id)) AS data FROM (${dependencyTables.map(table => `SELECT '${table}' AS source, id FROM ${table}`).join(' UNION ALL ')} ORDER BY source, id)`
const foreignKeyQuery = `SELECT json_group_array(json_object('table', "table", 'rowid', rowid, 'parent', parent, 'fkid', fkid)) AS data FROM pragma_foreign_key_check`

const before = jsonQuery(classQuery)
const dependenciesBefore = jsonQuery(dependencyQuery)
assert.deepEqual(jsonQuery(foreignKeyQuery), [], 'Resolve existing foreign-key violations before migrating')
const writeIns = before.filter(row => row.teacherName?.trim())
const affected = writeIns.filter(row => row.guardianId !== null)
console.log(`Before: ${before.length} classes; ${writeIns.length} write-in teachers; ${affected.length} guardian associations to clear.`)

const migration = readFileSync(new URL('../drizzle/0050_nullable_class_guardian.sql', import.meta.url), 'utf8')
// libSQL's in-place ALTER does not drop the table or any dependent rows.
for (const statement of migration.split('--> statement-breakpoint')) sql(statement)

const after = jsonQuery(classQuery)
assert.deepEqual(after, before.map(row => row.teacherName?.trim() ? { ...row, guardianId: null } : row), 'Only write-in guardian associations may change')
assert.deepEqual(jsonQuery(dependencyQuery), dependenciesBefore, 'All dependent rows must be preserved')
assert.deepEqual(jsonQuery(foreignKeyQuery), [], 'Foreign-key integrity must be preserved')
const columns = jsonQuery(`SELECT json_group_array(json_object('name', name, 'notNull', "notnull")) AS data FROM pragma_table_info('class_teaching_requests')`)
assert.equal(columns.find(column => column.name === 'guardian_id').notNull, 0)

const hash = createHash('sha256').update(migration).digest('hex')
sql(`INSERT INTO __drizzle_migrations (hash, created_at) SELECT '${hash}', 1788998400000 WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = '${hash}')`)
console.log(`Verified: ${affected.length} associations cleared; ${before.length - writeIns.length} linked-teacher classes preserved; ${dependenciesBefore.length} dependent rows preserved; no foreign-key violations.`)
