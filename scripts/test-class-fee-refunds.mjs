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
const rules = load('lib/session-fee-rules.ts')
const lineItems = load('lib/financial-line-items.ts', { ...mocks, '@/lib/session-fee-rules': rules })
const snapshots = load('lib/payment-snapshots.ts', { ...mocks, '@/lib/financial-line-items': lineItems })
mocks['@/lib/payment-snapshots'] = snapshots
const ledger = load('lib/class-fee-ledger.ts', mocks)
const refundHelpers = load('lib/class-fee-refunds.ts', mocks)
const { recordClassFeeRefund } = refundHelpers
const { recordHistoricalClassRefund } = load('lib/historical-class-refunds.ts', { ...mocks, '@/lib/class-fee-refunds': refundHelpers })
const { availableClassReimbursement } = load('lib/reimbursement-balance.ts', mocks)
const calculations = load('lib/fee-calculation.ts', { ...mocks, '@/lib/class-fee-ledger': ledger, '@/lib/session-fee-rules': load('lib/session-fee-rules.ts') })
try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.children, schema.classRegistrations, schema.classTeachingRequests, schema.schedules, schema.familySessionFees, schema.feePayments, schema.sessionFeeConfigs, schema.teacherReimbursements]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.filter(column => column.name !== 'billing_snapshot').map(column => {
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
  for (const statement of readFileSync(new URL('../drizzle/0060_payment_billing_snapshots.sql', import.meta.url), 'utf8').split('--> statement-breakpoint')) await client.execute(statement)
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
  const [recordedPayment] = await db.select().from(schema.feePayments)
  const snapshot = recordedPayment.billingSnapshot
  assert.ok(snapshot)
  assert.equal(JSON.parse(snapshot).totalFee, 135)
  await client.execute("UPDATE class_teaching_requests SET class_name = 'Renamed', fee_amount = 999, session_id = 'fall'")
  await client.execute("UPDATE session_fee_configs SET first_child_fee = 999")
  assert.equal((await db.select().from(schema.feePayments).where(eq(schema.feePayments.id, recordedPayment.id)))[0].billingSnapshot, snapshot, 'later price/enrollment changes cannot change a recorded transaction')

  await db.insert(schema.children).values({ id: 'old-child', familyId: 'old-family', firstName: 'Taylor', lastName: 'Test', grade: '3' })
  await db.insert(schema.familySessionFees).values({ id: 'old-fee', sessionId: 'fall', familyId: 'old-family', registrationFee: 100, classFees: 0, totalFee: 100, paidAmount: 130, dueDate: '2026-11-01' })
  const historicInput = { id: 'historic-refund', feeId: 'old-fee', childId: 'old-child', classId: 'art', originalAmount: 30, amount: 10, billTreatment: 'already_removed', method: 'paypal', reference: 'HISTORIC-1', notes: 'Receipt confirms previous Art fee', refundedAt: '2026-10-04' }
  await recordHistoricalClassRefund(historicInput, 'admin')
  await recordHistoricalClassRefund(historicInput, 'admin')
  assert.equal(await db.transaction(tx => availableClassReimbursement(tx, 'art')), 30, 'historical partial refunds cannot reduce already-adjusted class totals')
  await recordHistoricalClassRefund({ ...historicInput, id: 'historic-remainder', reference: 'HISTORIC-REMAINDER', amount: 20 }, 'admin')
  const [oldFee] = await db.select().from(schema.familySessionFees).where(eq(schema.familySessionFees.id, 'old-fee'))
  assert.equal(oldFee.totalFee, 100, 'already-removed class fee is not deducted twice')
  assert.equal(oldFee.paidAmount, 100)
  const [historicCharge] = await db.select().from(schema.familyClassCharges).where(eq(schema.familyClassCharges.familyId, 'old-family'))
  assert.equal(historicCharge.amountCents - historicCharge.refundedCents, 0)
  await assert.rejects(() => recordHistoricalClassRefund({ ...historicInput, id: 'again', reference: 'HISTORIC-2' }, 'admin'), /remaining refundable amount/)
  await db.insert(schema.familySessionFees).values({ id: 'billed-fee', sessionId: 'winter', familyId: 'old-family', registrationFee: 100, classFees: 30, totalFee: 130, paidAmount: 130, dueDate: '2026-11-01' })
  await client.execute("INSERT INTO class_teaching_requests (id, session_id, class_name, fee_amount) VALUES ('old-art', 'winter', 'Old Art', 999)")
  await recordHistoricalClassRefund({ ...historicInput, id: 'billed-refund', feeId: 'billed-fee', classId: 'old-art', billTreatment: 'still_billed', amount: 20, reference: 'BILLED-1' }, 'admin')
  const [billedFee] = await db.select().from(schema.familySessionFees).where(eq(schema.familySessionFees.id, 'billed-fee'))
  assert.equal(billedFee.totalFee, 110)
  assert.equal(billedFee.paidAmount, 110)
  assert.equal(await db.transaction(tx => availableClassReimbursement(tx, 'old-art')), 10, 'manual original price, not current price, determines retained class fee')
  console.log('Historical removed/still-billed refunds, duplicate protection, and immutable payment snapshots passed.')
  console.log('Class-change snapshots, partial refunds, fee waivers, payment history, retry protection, recalculation, and reimbursement accounting passed.')
} finally { client.close(); rmSync(directory, { recursive: true, force: true }) }
