'use client'

import { useEffect, useState } from 'react'
import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportTemplateCatalogItem, type ReportTemplateMappings, type ReportType } from '@/lib/report-types'
import { useToast } from './ToastContainer'

export default function ReportTemplateSettingsPanel() {
  const { showError, showSuccess } = useToast()
  const [templates, setTemplates] = useState<ReportTemplateCatalogItem[]>([])
  const [mappings, setMappings] = useState<ReportTemplateMappings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadedSuccessfully, setLoadedSuccessfully] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testingType, setTestingType] = useState<ReportType | null>(null)
  const [testMessage, setTestMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/report-templates', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to discover templates')
      setTemplates(result.templates || [])
      setMappings(result.mappings || {})
      setLoadedSuccessfully(true)
    } catch (error) {
      showError('Template discovery failed', error instanceof Error ? error.message : 'Unable to discover templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const select = (type: ReportType, value: string) => {
    if (!value) {
      setMappings((current) => { const next = { ...current }; delete next[type]; return next })
      return
    }
    const [slug, versionText] = value.split('@')
    const version = templates.find((template) => template.slug === slug)?.versions.find((item) => item.version === Number(versionText))
    if (version) setMappings((current) => ({ ...current, [type]: { slug, version: version.version, schemaHash: version.schemaHash } }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/report-templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save template selections')
      setMappings(result.mappings || {})
      showSuccess('Report templates saved', 'Published versions and schema hashes are now pinned.')
    } catch (error) {
      showError('Save failed', error instanceof Error ? error.message : 'Unable to save template selections')
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async (type: ReportType) => {
    setTestingType(type)
    setTestMessage('')
    try {
      const response = await fetch('/api/admin/report-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, to: testEmail.trim() }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send report test')
      setTestMessage(`${REPORT_TYPE_LABELS[type]} test sent to ${testEmail.trim()}.`)
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : 'Unable to send report test')
    } finally {
      setTestingType(null)
    }
  }

  if (loading) return <p className="py-8 text-sm text-gray-500">Discovering published templates...</p>

  return <div className="space-y-6"><div><h2 className="text-xl font-semibold text-gray-900">Report Templates</h2><p className="mt-1 text-sm text-gray-600">Select an immutable published template version for each generated PDF. Refresh after publishing a new version in the report service.</p></div><div className="space-y-4">{REPORT_TYPES.map((type) => { const selection = mappings[type]; return <label key={type} className="block rounded-lg border border-gray-200 p-4"><span className="text-sm font-semibold text-gray-900">{REPORT_TYPE_LABELS[type]}</span><select value={selection ? `${selection.slug}@${selection.version}` : ''} onChange={(event) => select(type, event.target.value)} className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Not configured</option>{templates.flatMap((template) => [...template.versions].sort((a, b) => b.version - a.version).map((version) => <option key={`${template.slug}@${version.version}`} value={`${template.slug}@${version.version}`}>{template.name} ({template.slug}) v{version.version}</option>))}</select>{selection && <span className="mt-2 block break-all text-xs text-gray-500">Schema: {selection.schemaHash}</span>}</label> })}</div><div className="flex flex-wrap gap-3"><button type="button" onClick={save} disabled={saving || !loadedSuccessfully} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save template selections'}</button><button type="button" onClick={() => void load()} disabled={saving} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Refresh catalog</button></div><section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><h3 className="font-semibold text-blue-950">Test generated documents</h3><p className="mt-1 text-sm text-blue-800">Save template selections first. Each test uses sample data and the complete production workflow: submit, poll, download, verify, and email the PDF attachment.</p><label className="mt-4 block max-w-md text-sm font-medium text-blue-950">Recipient email<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="test@example.com" className="mt-1 block w-full rounded-md border border-blue-200 bg-white px-3 py-2 font-normal text-gray-900" /></label><div className="mt-4 flex flex-wrap gap-2">{REPORT_TYPES.map((type) => <button key={type} type="button" onClick={() => void sendTest(type)} disabled={!mappings[type] || !testEmail.trim() || Boolean(testingType)} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{testingType === type ? 'Generating...' : `Send ${REPORT_TYPE_LABELS[type]} test`}</button>)}</div>{testMessage && <p className="mt-3 text-sm text-blue-900">{testMessage}</p>}</section></div>
}
