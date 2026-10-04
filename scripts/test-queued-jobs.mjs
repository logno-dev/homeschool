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
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, process, setTimeout, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}

const directory = mkdtempSync(join(tmpdir(), 'dvclc-queued-jobs-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })

try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.families, schema.guardians, schema.sessions, schema.familySessionFees, schema.queuedJobs]) {
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
  await client.execute('CREATE UNIQUE INDEX queued_jobs_deduplication_key_unique ON queued_jobs (deduplication_key)')

  await db.insert(schema.families).values({ id: 'family', name: 'Rivera', address: '1 Main St', phone: '555-0100', email: 'family@example.com', sharingCode: 'share' })
  await db.insert(schema.guardians).values({ id: 'guardian', familyId: 'family', email: 'guardian@example.com', firstName: 'Alex', lastName: 'Rivera' })
  await db.insert(schema.sessions).values({ id: 'session', name: 'Fall', startDate: '2026-09-01', endDate: '2026-12-01', registrationStartDate: '2026-07-01', registrationEndDate: '2026-08-01' })
  await db.insert(schema.familySessionFees).values({ id: 'fee', familyId: 'family', sessionId: 'session', totalFee: 125, paidAmount: 25, dueDate: '2026-10-01' })
  await db.insert(schema.familySessionFees).values({ id: 'invalid-fee', familyId: 'family', sessionId: 'session', totalFee: 125, paidAmount: 25, dueDate: '2026-10-01' })
  await db.insert(schema.familySessionFees).values({ id: 'changing-fee', familyId: 'family', sessionId: 'session', totalFee: 125, paidAmount: 25, dueDate: '2026-10-01' })
  await db.insert(schema.familySessionFees).values({ id: 'racing-fee', familyId: 'family', sessionId: 'session', totalFee: 125, paidAmount: 25, dueDate: '2026-10-01' })

  let deliveries = 0
  let permanentFailure = false
  let feeToUpdateBeforeSend = null
  const idempotencyKeys = []
  const jobErrors = load('lib/job-errors.ts')
  const queuedJobHelpers = load('lib/queued-jobs.ts', {
    'server-only': {},
    '@/lib/db': { db },
    '@/lib/schema': schema,
    '@/lib/job-errors': jobErrors,
    '@/lib/financial-line-items': { getFinancialLineItems: async () => [{ description: 'Session fees', amount: 125 }] },
    '@/lib/email': {
      sendPaymentInvoiceEmail: async (input, idempotencyKey, _reportSubmissionKey, beforeSend) => {
        deliveries += 1
        idempotencyKeys.push(idempotencyKey)
        assert.equal(input.balanceDue, 100)
        if (permanentFailure) throw new jobErrors.PermanentJobError('Invalid report template')
        if (deliveries === 1) throw new Error('Report service timed out')
        if (feeToUpdateBeforeSend) {
          await db.update(schema.familySessionFees).set({ updatedAt: '2026-09-27T13:00:00.000Z' }).where(eq(schema.familySessionFees.id, feeToUpdateBeforeSend))
          feeToUpdateBeforeSend = null
        }
        if (beforeSend && !(await beforeSend())) deliveries -= 1
      }
    }
  })

  const job = await queuedJobHelpers.enqueuePaymentInvoice('fee', 'guardian')
  assert.equal((await queuedJobHelpers.processQueuedJob(job.id)).status, 'queued', 'A transient failure remains queued')
  const duplicate = await queuedJobHelpers.enqueuePaymentInvoice('fee', 'guardian')
  assert.equal(duplicate.id, job.id, 'The same fee deduplicates to one invoice job')
  assert.equal((await db.select().from(schema.queuedJobs)).length, 1)

  await db.update(schema.queuedJobs).set({ nextAttemptAt: new Date(Date.now() - 1_000).toISOString() }).where(eq(schema.queuedJobs.id, job.id))
  const summary = await queuedJobHelpers.processDueQueuedJobs()
  assert.equal(summary.completed, 1)
  assert.equal(deliveries, 2)
  assert.deepEqual(idempotencyKeys, [job.id, job.id], 'Retries retain a stable provider idempotency key')
  const [completed] = await db.select().from(schema.queuedJobs).where(eq(schema.queuedJobs.id, job.id))
  assert.equal(completed.status, 'completed')
  assert.equal(completed.attempts, 2)
  assert.equal((await queuedJobHelpers.processQueuedJob(job.id)).status, 'skipped', 'Completed jobs cannot be claimed again')

  permanentFailure = true
  const invalidJob = await queuedJobHelpers.enqueuePaymentInvoice('invalid-fee', 'guardian')
  assert.equal((await queuedJobHelpers.processQueuedJob(invalidJob.id)).status, 'failed', 'Permanent provider errors do not loop forever')

  permanentFailure = false
  const oldVersion = await queuedJobHelpers.enqueuePaymentInvoice('changing-fee', 'guardian')
  await db.update(schema.familySessionFees).set({ updatedAt: '2026-09-27T12:00:00.000Z' }).where(eq(schema.familySessionFees.id, 'changing-fee'))
  const newVersion = await queuedJobHelpers.enqueuePaymentInvoice('changing-fee', 'guardian')
  const deliveriesBeforeVersionCheck = deliveries
  assert.equal((await queuedJobHelpers.processQueuedJob(oldVersion.id)).status, 'completed')
  assert.equal((await queuedJobHelpers.processQueuedJob(newVersion.id)).status, 'completed')
  assert.equal(deliveries, deliveriesBeforeVersionCheck + 1, 'A superseded queued invoice is not delivered')

  const racingVersion = await queuedJobHelpers.enqueuePaymentInvoice('racing-fee', 'guardian')
  feeToUpdateBeforeSend = 'racing-fee'
  const deliveriesBeforeRace = deliveries
  assert.equal((await queuedJobHelpers.processQueuedJob(racingVersion.id)).status, 'completed')
  assert.equal(deliveries, deliveriesBeforeRace, 'A fee update during report generation suppresses the stale email')

  console.log('Queued invoice deduplication, transient retry, permanent failure handling, version supersession, pre-send validation, stable idempotency, and completion verified.')
} finally {
  client.close()
  rmSync(directory, { recursive: true, force: true })
}
