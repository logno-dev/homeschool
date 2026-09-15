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
import { eq, sql } from 'drizzle-orm'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, console, process, Request, Response, URL, require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name) })
  return module.exports
}

const directory = mkdtempSync(join(tmpdir(), 'dvclc-scholarship-admin-'))
const client = createClient({ url: pathToFileURL(join(directory, 'test.db')).href })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })

try {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.scholarshipApplications, schema.familySessionFees, schema.feePayments, schema.scholarshipFundTransactions]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.map((column) => {
      let definition = `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}`
      if (column.default !== undefined) {
        const value = column.default
        definition += ` DEFAULT ${typeof value === 'object' ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : Number(value)}`
      }
      return definition
    })
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }

  await db.insert(schema.familySessionFees).values({ id: 'fee', familyId: 'family', sessionId: 'session', totalFee: 200, registrationFee: 75, classFees: 125, paidAmount: 0, status: 'unpaid', dueDate: '2026-10-01' })
  await db.insert(schema.scholarshipApplications).values({ id: 'application', familyId: 'family', sessionId: 'session', guardianId: 'guardian', scholarshipType: 'partial', requestedAmount: 60, reason: 'Need', status: 'pending' })
  await db.insert(schema.scholarshipFundTransactions).values({ id: 'donation', amount: 10, transactionType: 'donation', source: 'cash' })

  const approve = load('app/api/admin/scholarship-applications/[applicationId]/route.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema,
    '@/lib/server-auth': { getAuthenticatedAdmin: async () => ({ session: { user: { id: 'admin' } } }) }
  }).PATCH
  const response = await approve(new Request('http://localhost/api/admin/scholarship-applications/application', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', approvedAmount: 200, reviewNotes: 'Comp full balance' }) }), { params: Promise.resolve({ applicationId: 'application' }) })
  assert.equal(response.status, 200)
  const [fee] = await db.select().from(schema.familySessionFees).where(eq(schema.familySessionFees.id, 'fee'))
  const [application] = await db.select().from(schema.scholarshipApplications).where(eq(schema.scholarshipApplications.id, 'application'))
  const [fund] = await db.select({ balance: sql`sum(${schema.scholarshipFundTransactions.amount})` }).from(schema.scholarshipFundTransactions)
  assert.equal(fee.paidAmount, 200)
  assert.equal(fee.status, 'paid')
  assert.equal(application.approvedAmount, 200)
  assert.equal(Number(fund.balance), -190)
  console.log('Admin full-balance scholarship awards and negative fund balances verified.')
} finally {
  client.close()
  rmSync(directory, { recursive: true, force: true })
}
