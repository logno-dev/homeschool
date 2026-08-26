'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import { isFieldAvailable, REPORT_FIELDS, type ReportDefinition, type ReportField, type ReportFilter } from '@/lib/report-fields'

type Session = { id: string; name: string }
type SavedReport = { id: string; name: string; definition: ReportDefinition }

const emptyFilter = (): ReportFilter => ({ field: 'familyName', operator: 'contains', value: '' })

export default function CustomReportsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [name, setName] = useState('')
  const [definition, setDefinition] = useState<ReportDefinition>({ scope: 'users', sessionId: '', columns: ['userName', 'userEmail'], filters: [] })
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sessionPrompt, setSessionPrompt] = useState(false)

  const sessionRequired = definition.scope === 'roster' || definition.columns.some((column) => ['paymentStatus', 'paidAmount', 'totalAmount'].includes(column))
  const availableFields = REPORT_FIELDS.filter((field) => isFieldAvailable(field.key, definition.scope))

  const load = async () => {
    const [sessionResponse, reportResponse] = await Promise.all([fetch('/api/admin/sessions'), fetch('/api/admin/reports/custom')])
    const sessionData = await sessionResponse.json() as { sessions?: Session[] }
    const reportData = await reportResponse.json() as { reports?: SavedReport[] }
    setSessions(sessionData.sessions || [])
    setSaved(reportData.reports || [])
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signin'); return }
    load().catch(() => setMessage('Unable to load custom reports'))
  }, [loading, user, router])

  const toggleColumn = (field: ReportField) => setDefinition((current) => ({ ...current, columns: current.columns.includes(field) ? current.columns.filter((column) => column !== field) : [...current.columns, field] }))
  const changeScope = (scope: ReportDefinition['scope']) => setDefinition((current) => ({ ...current, scope, sessionId: '', columns: current.columns.filter((column) => isFieldAvailable(column, scope)), filters: current.filters.filter((filter) => isFieldAvailable(filter.field, scope)) }))
  const preview = async () => {
    if (sessionRequired && !definition.sessionId) { setSessionPrompt(true); setMessage('Select a session to preview this report'); return }
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/admin/reports/custom/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definition }) })
      const data = await response.json() as { rows?: Record<string, unknown>[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'Unable to run report')
      setRows(data.rows || []); setMessage(`${data.rows?.length || 0} rows`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to run report') } finally { setBusy(false) }
  }
  const save = async () => {
    if (!name.trim()) { setMessage('Enter a report name'); return }
     const response = await fetch('/api/admin/reports/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, definition: { ...definition, sessionId: '' } }) })
    const data = await response.json() as { error?: string }
    setMessage(response.ok ? 'Report saved' : data.error || 'Unable to save report')
    if (response.ok) await load()
  }
  const exportCsv = async () => {
    if (sessionRequired && !definition.sessionId) { setSessionPrompt(true); setMessage('Select a session to export this report'); return }
    const response = await fetch('/api/admin/reports/custom/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definition, format: 'csv' }) })
    if (!response.ok) { setMessage('Unable to export report'); return }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'custom-report.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin'
  if (loading || !user) return <div className="min-h-screen bg-gray-50" />

  return <AdminLayout userName={userName} activeTab="reports">
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8"><div className="space-y-6 px-4 sm:px-0">
      <div><h1 className="text-2xl font-bold text-gray-900">Custom report builder</h1><p className="mt-1 text-sm text-gray-600">Build reusable reports from users or registered class rosters. Choose a session only when the report needs session-specific data.</p></div>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
         <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Saved reports</h2><div className="mt-3 space-y-1">{saved.map((report) => <button key={report.id} onClick={() => { setName(report.name); setDefinition({ ...report.definition, sessionId: '' }); setSessionPrompt(false); setRows([]); setMessage('Loaded report') }} className="block w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50">{report.name}</button>)}{!saved.length && <p className="text-sm text-gray-500">No saved reports yet.</p>}</div></aside>
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
           <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Report source<select value={definition.scope} onChange={(event) => changeScope(event.target.value as ReportDefinition['scope'])} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal"><option value="users">All users</option><option value="roster">Registered class roster</option></select></label><label className="text-sm font-medium">Save as<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Report name" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
           <fieldset className="mt-6"><legend className="font-semibold">Columns</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{availableFields.map((field) => <label key={field.key} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={definition.columns.includes(field.key)} onChange={() => toggleColumn(field.key)} />{field.label}</label>)}</div></fieldset>
           <div className="mt-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Filters</h2><button onClick={() => setDefinition({ ...definition, filters: [...definition.filters, emptyFilter()] })} className="text-sm text-blue-600">Add filter</button></div><div className="mt-2 space-y-2">{definition.filters.map((filter, index) => <div key={index} className="flex flex-wrap gap-2"><select value={filter.field} onChange={(event) => { const filters = [...definition.filters]; filters[index] = { ...filter, field: event.target.value as ReportField }; setDefinition({ ...definition, filters }) }} className="rounded border border-gray-300 px-2 py-2 text-sm">{availableFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select><select value={filter.operator} onChange={(event) => { const filters = [...definition.filters]; filters[index] = { ...filter, operator: event.target.value as ReportFilter['operator'] }; setDefinition({ ...definition, filters }) }} className="rounded border border-gray-300 px-2 py-2 text-sm"><option value="contains">contains</option><option value="equals">equals</option><option value="startsWith">starts with</option><option value="isEmpty">is empty</option></select>{filter.operator !== 'isEmpty' && <input value={filter.value || ''} onChange={(event) => { const filters = [...definition.filters]; filters[index] = { ...filter, value: event.target.value }; setDefinition({ ...definition, filters }) }} className="min-w-40 flex-1 rounded border border-gray-300 px-2 py-2 text-sm" placeholder="Value" />}<button onClick={() => setDefinition({ ...definition, filters: definition.filters.filter((_, itemIndex) => itemIndex !== index) })} className="px-2 text-sm text-red-600">Remove</button></div>)}{!definition.filters.length && <p className="text-sm text-gray-500">No filters. All registered roster rows will be included.</p>}</div></div>
           <div className="mt-6 flex flex-wrap items-end gap-2"><button onClick={preview} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? 'Running...' : 'Preview'}</button><button onClick={save} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">Save report</button><button onClick={exportCsv} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">Export CSV</button>{sessionPrompt && sessionRequired && <label className="text-sm font-medium">Session<select autoFocus value={definition.sessionId} onChange={(event) => { setDefinition({ ...definition, sessionId: event.target.value }); setSessionPrompt(false) }} className="ml-2 rounded-md border border-gray-300 px-3 py-2 font-normal"><option value="">Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>}{message && <span className="self-center text-sm text-gray-600">{message}</span>}</div>
          {rows.length > 0 && <div className="mt-6 overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-left text-sm"><thead><tr>{definition.columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">{REPORT_FIELDS.find((field) => field.key === column)?.label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row, index) => <tr key={index}>{definition.columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-2">{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div>}
        </section>
      </div>
    </div></main>
  </AdminLayout>
}
