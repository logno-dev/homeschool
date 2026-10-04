import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
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
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => mocks[name] ?? require(name) })
  return module.exports
}

const directory = mkdtempSync(join(tmpdir(), 'dvclc-refunds-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })
const mocks = { '@/lib/db': { db }, '@/lib/schema': schema }
const ledger = load('lib/class-fee-ledger.ts', mocks)
const { recordClassFeeRefund } = load('lib/class-fee-refunds.ts', mocks)
const { availableClassReimbursement } = load('lib/reimbursement-balance.ts', mocks)
const calculations = load('lib/fee-calculation.ts', { ...mocks, '@/lib/class-fee-ledger': ledger, '@/lib/session-fee-rules': load('lib/session-fee-rules.ts') })
try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.children, schema.classRegistrations, schema.classTeachingRequests, schema.schedules, schema.familySessionFees, schema.feePayments, schema.sessionFeeConfigs, schema.teacherReimbursements]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.map(column => {
      let text = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`
      if (column.default !== undefined) text += ` DEFAULT ${typeof column.default === 'object' ? dialect.sqlToQuery(column.default).sql : typeof column.default === 'string' ? `'${column.default}'` : Number(column.default)}`
      return text
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }
  await db.insert(schema.children).values({ id: 'kid', familyId: 'family', firstName: 'Sam', lastName: 'Test', grade: '3' })
  await client.execute("INSERT INTO class_teaching_requests (id, class_name, fee_amount, registration_fee_exempt) VALUES ('art', 'Art', 30, 0), ('science', 'Science', 20, 0)")
  await client.execute("INSERT INTO schedules (id, class_teaching_request_id) VALUES ('s1', 'art'), ('s2', 'science')")
  await client.execute("INSERT INTO class_registrations (id, child_id, family_id, session_id, schedule_id, status) VALUES ('reg', 'kid', 'family', 'fall', 's1', 'registered')")
  for (const statement of readFileSync(new URL('../drizzle/0059_class_fee_refunds.sql', import.meta.url), 'utf8').split('--> statement-breakpoint')) await client.execute(statement)
  await db.insert(schema.sessionFeeConfigs).values({ id: 'config', sessionId: 'fall', firstChildFee: 100, additionalChildFee: 50, dueDate: '2026-11-01' })
  await db.insert(schema.familySessionFees).values({ id: 'fee', sessionId: 'fall', familyId: 'family', registrationFee: 100, classFees: 30, totalFee: 130, paidAmount: 130, dueDate: '2026-11-01' })
  await db.update(schema.classRegistrations).set({ scheduleId: 's2' }).where(eq(schema.classRegistrations.id, 'reg'))
  await calculations.createOrUpdateFamilySessionFee('fall', 'family')
  let [fee] = await db.select().from(schema.familySessionFees)
  assert.equal(fee.totalFee, 150, 'dropped fee stays until admin decision')
  const [oldCharge] = await db.select().from(schema.familyClassCharges).where(eq(schema.familyClassCharges.classTeachingRequestId, 'art'))
  assert.equal(oldCharge.status, 'review')
  const input = { id: 'refund1', chargeId: oldCharge.id, amount: 15, method: 'paypal', reference: 'PAYPAL-REFUND-1', notes: 'Partial material fee refund', refundedAt: '2026-10-04' }
  await recordClassFeeRefund(input, 'admin')
  await recordClassFeeRefund(input, 'admin')
  ;[fee] = await db.select().from(schema.familySessionFees)
  assert.equal(fee.totalFee, 135)
  assert.equal(fee.paidAmount, 115)
  assert.equal((await db.select().from(schema.feePayments)).length, 1, 'retry cannot return money twice')
  assert.equal(await db.transaction(tx => availableClassReimbursement(tx, 'art')), 15)
  await assert.rejects(() => recordClassFeeRefund({ ...input, id: 'too-large', amount: 16, reference: 'another' }, 'admin'), /exceeds/)
  await assert.rejects(() => recordClassFeeRefund({ ...input, id: 'duplicate-ref' }, 'admin'), /already been recorded/)
  await calculations.createOrUpdateFamilySessionFee('fall', 'family')
  ;[fee] = await db.select().from(schema.familySessionFees)
  assert.equal(fee.totalFee, 135, 'recalculation cannot restore refunded charge')
  await recordClassFeeRefund({ ...input, id: 'refund2', method: 'waiver', reference: '', amount: 15 }, 'admin')
  assert.equal(await db.transaction(tx => availableClassReimbursement(tx, 'art')), 0, 'refund and waiver reduce class total exactly once')
  await db.insert(schema.teacherReimbursements).values({ id: 'teacher', classTeachingRequestId: 'science', sessionId: 'fall', guardianId: 'teacher', amount: 12, status: 'paid' })
  assert.equal(await db.transaction(tx => availableClassReimbursement(tx, 'science')), 8)
  await db.update(schema.classRegistrations).set({ scheduleId: 's1' }).where(eq(schema.classRegistrations.id, 'reg'))
  await calculations.createOrUpdateFamilySessionFee('fall', 'family')
  assert.equal(await db.transaction(tx => availableClassReimbursement(tx, 'art')), 30, 'rejoining after refund creates a new charge')
  const [droppedScience] = await db.select().from(schema.familyClassCharges).where(eq(schema.familyClassCharges.classTeachingRequestId, 'science'))
  await recordClassFeeRefund({ ...input, id: 'retain', chargeId: droppedScience.id, amount: 0, method: 'retain', reference: '' }, 'admin')
  assert.equal(await db.transaction(tx => availableClassReimbursement(tx, 'science')), 8, 'retaining the fee leaves reimbursements unchanged')
  await assert.rejects(() => recordClassFeeRefund({ ...input, id: 'retain-again', chargeId: droppedScience.id, amount: 0, method: 'retain', reference: '' }, 'admin'), /already been reviewed/)
  const activeCharge = (await db.select().from(schema.familyClassCharges).where(eq(schema.familyClassCharges.classTeachingRequestId, 'art')))[0]
  await assert.rejects(() => recordClassFeeRefund({ ...input, id: 'active-refund', chargeId: activeCharge.id, reference: 'active' }, 'admin'), /Only dropped-class/)
  await assert.rejects(() => recordClassFeeRefund({ ...input, id: 'invalid', amount: -1 }, 'admin'), /valid amount/)
  console.log('Class-change snapshots, partial refunds, fee waivers, payment history, retry protection, recalculation, and reimbursement accounting passed.')
} finally { client.close(); rmSync(directory, { recursive: true, force: true }) }
