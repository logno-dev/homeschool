import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => mocks[name] ?? require(name) })
  return module.exports
}

const grades = load('lib/grades.ts')
const { getGradeRangeFromLabel, isGradeWithinRange } = grades
const { getClassSlotTarget } = load('lib/class-teaching.ts', { './grades': grades })

assert.deepEqual({ ...getGradeRangeFromLabel('All Ages') }, { from: 0, to: 12 })
assert.deepEqual({ ...getGradeRangeFromLabel('Any Age') }, { from: 0, to: 12 })
assert.equal(isGradeWithinRange('Nursery', -1, 12, 'All Ages'), false)
assert.equal(isGradeWithinRange('Toddler', -1, 12, 'All Ages'), false)
assert.equal(isGradeWithinRange('Preschool', -1, 12, 'All Ages'), false)
assert.equal(isGradeWithinRange('K', -1, 12, 'All Ages'), true)
assert.equal(isGradeWithinRange('12th', -1, 12, 'All Ages'), true)
assert.equal(isGradeWithinRange('Preschool', -1, -1, 'Preschool'), true)
assert.equal(getClassSlotTarget('Nursery'), 1)
assert.equal(getClassSlotTarget('Toddler'), 1)
assert.equal(getClassSlotTarget('Preschool'), 1)
assert.equal(getClassSlotTarget('K-2'), 3)

console.log('Grade eligibility and per-range teaching-slot targets passed.')
