'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'
import { getReportColumnLabel, isFieldAvailable, REPORT_FIELD_GROUPS, REPORT_FIELDS, type ReportDefinition, type ReportField, type ReportFilter } from '@/lib/report-fields'

type Session = { id: string; name: string; startDate: string; isActive: boolean }
type SavedReport = { id: string; name: string; definition: ReportDefinition }

export default function CustomReportsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [name, setName] = useState('')
  const [definition, setDefinition] = useState<ReportDefinition>({ scope: 'users', sessionId: '', columns: ['userName', 'userEmail'], filters: [], distinctRows: false })
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const sessionRequired = definition.scope !== 'users' || definition.columns.some((column) => ['paymentStatus', 'paidAmount', 'totalAmount'].includes(column))
  const defaultSessionId = sessions.find((session) => session.isActive)?.id || sessions[0]?.id || ''
  const canRun = definition.columns.length > 0 && (!sessionRequired || Boolean(definition.sessionId))
  const availableFields = REPORT_FIELDS.filter((field) => isFieldAvailable(field.key, definition.scope))
  const availableFieldGroups = REPORT_FIELD_GROUPS[definition.scope].map((group) => ({
    ...group,
    fields: group.fields.map((key) => REPORT_FIELDS.find((field) => field.key === key)!)
  }))

  const load = async () => {
    const [sessionResponse, reportResponse] = await Promise.all([fetch('/api/admin/sessions'), fetch('/api/admin/reports/custom')])
    const sessionData = await sessionResponse.json() as { sessions?: Session[] }
    const reportData = await reportResponse.json() as { reports?: SavedReport[] }
    setSessions((sessionData.sessions || []).sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.startDate.localeCompare(a.startDate)))
    setSaved(reportData.reports || [])
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/signin'); return }
    load().catch(() => setMessage('Unable to load custom reports'))
  }, [loading, user, router])

  const toggleColumn = (field: ReportField) => setDefinition((current) => ({ ...current, columns: current.columns.includes(field) ? current.columns.filter((column) => column !== field) : [...current.columns, field] }))
  const addFilter = () => {
    const field = availableFields[0]?.key
    if (field) setDefinition((current) => ({ ...current, filters: [...current.filters, { field, operator: 'contains', value: '' }] }))
  }
  const changeScope = (scope: ReportDefinition['scope']) => {
    setDefinition((current) => ({ ...current, scope, sessionId: scope === 'users' ? '' : current.sessionId || defaultSessionId, columns: current.columns.filter((column) => isFieldAvailable(column, scope)), filters: current.filters.filter((filter) => isFieldAvailable(filter.field, scope)) }))
    setRows([]); setMessage('')
  }
  const preview = async () => {
    if (!canRun) { setMessage(sessionRequired && !definition.sessionId ? 'Select a session to preview this report' : 'Select at least one column'); return }
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
    if (!canRun) { setMessage(sessionRequired && !definition.sessionId ? 'Select a session to export this report' : 'Select at least one column'); return }
    const response = await fetch('/api/admin/reports/custom/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definition, format: 'csv' }) })
    if (!response.ok) { setMessage('Unable to export report'); return }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'custom-report.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin'
  if (loading || !user) return <div className="min-h-screen bg-gray-50" />

  return <AdminLayout userName={userName} activeTab="reports">
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8"><div className="space-y-6 px-4 sm:px-0">
      <div><h1 className="text-2xl font-bold text-gray-900">Custom report builder</h1><p className="mt-1 text-sm text-gray-600">Choose what each row represents, then add attributes from related records.</p></div>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
         <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Saved reports</h2><div className="mt-3 space-y-1">{saved.map((report) => <button key={report.id} onClick={() => { setName(report.name); setDefinition({ ...report.definition, sessionId: report.definition.scope === 'users' ? '' : defaultSessionId }); setRows([]); setMessage('Loaded report') }} className="block w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50">{report.name}</button>)}{!saved.length && <p className="text-sm text-gray-500">No saved reports yet.</p>}</div></aside>
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
           <div className={`grid gap-4 ${sessionRequired ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}><label className="text-sm font-medium">One row per<select value={definition.scope} onChange={(event) => changeScope(event.target.value as ReportDefinition['scope'])} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal"><option value="users">User</option><option value="roster">Class registration</option><option value="classes">Scheduled class</option><option value="volunteerJobs">Volunteer assignment</option></select></label>{sessionRequired && <label className="text-sm font-medium">Session<select value={definition.sessionId} onChange={(event) => { setDefinition({ ...definition, sessionId: event.target.value }); setRows([]); setMessage('') }} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal"><option value="">Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.isActive ? ' (active)' : ''}</option>)}</select></label>}<label className="text-sm font-medium">Save as<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Report name" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
           <fieldset className="mt-6"><legend className="font-semibold">Columns</legend><p className="mt-1 text-sm text-gray-500">Open a related item to choose its attributes.</p><div className="mt-3 grid items-start gap-3 md:grid-cols-2">{availableFieldGroups.map((group) => { const selectedCount = group.fields.filter((field) => definition.columns.includes(field.key)).length; return <details key={group.label} open={selectedCount > 0} className="rounded-md border border-gray-200 bg-gray-50 open:bg-white"><summary className="cursor-pointer select-none px-3 py-2 font-medium text-gray-800">{group.label}<span className="ml-2 text-xs font-normal text-gray-500">{selectedCount ? `${selectedCount} selected` : ''}</span></summary><div className="space-y-2 border-t border-gray-200 px-3 py-3">{group.fields.map((field) => <label key={field.key} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={definition.columns.includes(field.key)} onChange={() => toggleColumn(field.key)} />{field.label}</label>)}</div></details> })}</div></fieldset>
           <label className="mt-4 flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-0.5" checked={definition.distinctRows} onChange={(event) => setDefinition({ ...definition, distinctRows: event.target.checked })} /><span><span className="font-medium">Remove duplicate rows</span><span className="block text-gray-500">Keep one row when all selected column values are identical.</span></span></label>
           <div className="mt-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Filters</h2><button onClick={addFilter} className="text-sm text-blue-600">Add filter</button></div><div className="mt-2 space-y-2">{definition.filters.map((filter, index) => <div key={index} className="flex flex-wrap gap-2"><select value={filter.field} onChange={(event) => { const filters = [...definition.filters]; filters[index] = { ...filter, field: event.target.value as ReportField }; setDefinition({ ...definition, filters }) }} className="rounded border border-gray-300 px-2 py-2 text-sm">{availableFields.map((field) => <option key={field.key} value={field.key}>{getReportColumnLabel(field.key, definition.scope)}</option>)}</select><select value={filter.operator} onChange={(event) => { const filters = [...definition.filters]; filters[index] = { ...filter, operator: event.target.value as ReportFilter['operator'] }; setDefinition({ ...definition, filters }) }} className="rounded border border-gray-300 px-2 py-2 text-sm"><option value="contains">contains</option><option value="equals">equals</option><option value="startsWith">starts with</option><option value="isEmpty">is empty</option></select>{filter.operator !== 'isEmpty' && <input value={filter.value || ''} onChange={(event) => { const filters = [...definition.filters]; filters[index] = { ...filter, value: event.target.value }; setDefinition({ ...definition, filters }) }} className="min-w-40 flex-1 rounded border border-gray-300 px-2 py-2 text-sm" placeholder="Value" />}<button onClick={() => setDefinition({ ...definition, filters: definition.filters.filter((_, itemIndex) => itemIndex !== index) })} className="px-2 text-sm text-red-600">Remove</button></div>)}{!definition.filters.length && <p className="text-sm text-gray-500">No filters. All rows from this source will be included.</p>}</div></div>
           <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-5"><button onClick={preview} disabled={busy || !canRun} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Running...' : 'Preview'}</button><button onClick={save} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">Save report</button><button onClick={exportCsv} disabled={!canRun} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Export CSV</button>{!canRun && <span className="text-sm text-amber-700">{!definition.columns.length ? 'Choose at least one column.' : 'Choose a session.'}</span>}{canRun && message && <span className="text-sm text-gray-600">{message}</span>}</div>
           {rows.length > 0 && <div className="mt-6"><div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Preview</h2><span className="text-sm text-gray-500">{rows.length} rows</span></div><div className="overflow-x-auto rounded-md border border-gray-200"><table className="min-w-full divide-y divide-gray-200 text-left text-sm"><thead className="bg-gray-50"><tr>{definition.columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">{getReportColumnLabel(column, definition.scope)}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row, index) => <tr key={index}>{definition.columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-2">{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div></div>}
        </section>
      </div>
    </div></main>
  </AdminLayout>
}
