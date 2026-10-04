import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig } from 'drizzle-orm/sqlite-core'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => mocks[name] ?? require(name) })
  return module.exports
}

const client = createClient({ url: ':memory:' })
const schema = load('lib/schema.ts')
const db = drizzle(client, { schema })
try {
  for (const table of [schema.children, schema.classRegistrations, schema.schedules, schema.classTeachingRequests]) {
    const { name, columns } = getTableConfig(table)
    // Only columns used by the queries need fixture values.
    const definitions = columns.map(column => `"${column.name}" ${column.getSQLType()}`)
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(', ')})`)
  }
  await client.execute("INSERT INTO children (id, first_name) VALUES ('child', 'Sam')")
  await client.execute("INSERT INTO class_teaching_requests (id, class_name, fee_amount) VALUES ('art', 'Art', 30), ('science', 'Science', 20)")
  await client.execute("INSERT INTO schedules (id, class_teaching_request_id) VALUES ('s1', 'art'), ('s2', 'science')")
  await client.execute("INSERT INTO class_registrations (child_id, schedule_id, session_id, family_id, status) VALUES ('child', 's1', 'fall', 'family', 'registered'), ('child', 's2', 'fall', 'family', 'registered'), ('child', 's1', 'fall', 'other', 'registered'), ('child', 's1', 'spring', 'family', 'registered'), ('child', 's1', 'fall', 'family', 'cancelled')")
  const { getFinancialLineItems } = load('lib/financial-line-items.ts', {
    '@/lib/db': { db }, '@/lib/schema': schema
  })
  const fee = { sessionId: 'fall', familyId: 'family', registrationFee: 200, classFees: 50, totalFee: 250 }
  const items = await getFinancialLineItems(fee)
  assert.equal(items.length, 3)
  assert.equal(items[1].description, 'Sam — Art')
  assert.equal(items.reduce((sum, item) => sum + item.amount, 0), 250)

  const adjusted = await getFinancialLineItems({ ...fee, totalFee: 225 })
  assert.equal(adjusted.at(-1).amount, -25)
  assert.equal(adjusted.reduce((sum, item) => sum + item.amount, 0), 225)

  await client.execute("UPDATE class_teaching_requests SET fee_amount = 40 WHERE id = 'art'")
  const historical = await getFinancialLineItems(fee)
  assert.equal(historical.length, 2)
  assert.equal(historical[1].description, 'Class fees (recorded subtotal)')
  assert.equal(historical[1].amount, 50)
  console.log('Financial line-item tests passed (scope, reconciliation, adjustments, changed prices).')
} finally {
  client.close()
}
