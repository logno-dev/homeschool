'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '../../components/AdminLayout'
import { useToast } from '../../components/ToastContainer'
import { APP_TIMEZONES, DEFAULT_APP_TIMEZONE } from '@/lib/timezones'

interface SettingsState {
  incrementDate: string
  lastRun: string | null
  registrationNotificationEmails: string
  classRequestNotificationEmails: string
  appTimezone: string
}

interface Handbook {
  id: string
  version: string
  filename: string
  blobUrl: string
  size: number
  isActive: boolean
  uploadedAt: string
  uploadedBy?: string | null
}

export default function AdminSettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showSuccess, showError } = useToast()
  const [settings, setSettings] = useState<SettingsState>({ incrementDate: '', lastRun: null, registrationNotificationEmails: '', classRequestNotificationEmails: '', appTimezone: DEFAULT_APP_TIMEZONE })
  const [handbooks, setHandbooks] = useState<Handbook[]>([])
  const [handbookVersion, setHandbookVersion] = useState('')
  const [handbookFile, setHandbookFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isPublishing, setIsPublishing] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/signin')
      return
    }

    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        if (!response.ok) {
          throw new Error('Failed to load settings')
        }
        const result = await response.json()
        setSettings({
          incrementDate: result.incrementDate || '',
          lastRun: result.lastRun || null,
          registrationNotificationEmails: result.registrationNotificationEmails || '',
          classRequestNotificationEmails: result.classRequestNotificationEmails || '',
          appTimezone: result.appTimezone || DEFAULT_APP_TIMEZONE
        })
        const handbooksResponse = await fetch('/api/admin/handbooks')
        if (handbooksResponse.ok) {
          const handbooksPayload = await handbooksResponse.json()
          setHandbooks(handbooksPayload.handbooks || [])
        }
      } catch (error) {
        showError('Settings error', error instanceof Error ? error.message : 'Unable to load settings')
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [loading, user, router, showError])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeIncrementDate: settings.incrementDate || null,
          registrationNotificationEmails: settings.registrationNotificationEmails,
          classRequestNotificationEmails: settings.classRequestNotificationEmails,
          appTimezone: settings.appTimezone
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save settings')
      }
       showSuccess('Settings saved', 'Global settings updated.')
    } catch (error) {
      showError('Save failed', error instanceof Error ? error.message : 'Unable to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRunNow = async () => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runIncrementNow: true })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to run grade increment')
      }
      setSettings((prev) => ({ ...prev, lastRun: result.lastRun || prev.lastRun }))
      showSuccess('Grades updated', `Updated ${result.updated || 0} students.`)
    } catch (error) {
      showError('Run failed', error instanceof Error ? error.message : 'Unable to run increment')
    } finally {
      setIsRunning(false)
    }
  }

  const uploadHandbook = async () => {
    if (!handbookFile || !handbookVersion.trim()) {
      showError('Upload incomplete', 'Choose a PDF and enter a handbook version.')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', handbookFile)
      formData.set('version', handbookVersion.trim())
      const response = await fetch('/api/admin/handbooks', { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload handbook')
      }
      setHandbooks((current) => [result.handbook, ...current])
      setHandbookFile(null)
      setHandbookVersion('')
      showSuccess('Handbook uploaded', 'You can publish it from the handbook list.')
    } catch (error) {
      showError('Upload failed', error instanceof Error ? error.message : 'Unable to upload handbook')
    } finally {
      setIsUploading(false)
    }
  }

  const publishHandbook = async (handbookId: string) => {
    setIsPublishing(handbookId)
    try {
      const response = await fetch(`/api/admin/handbooks/${handbookId}/publish`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to publish handbook')
      }
      setHandbooks((current) => current.map((handbook) => ({ ...handbook, isActive: handbook.id === handbookId })))
      showSuccess('Handbook published', 'Users will be asked to acknowledge the new active handbook on their next login.')
    } catch (error) {
      showError('Publish failed', error instanceof Error ? error.message : 'Unable to publish handbook')
    } finally {
      setIsPublishing(null)
    }
  }

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin'

  return (
    <AdminLayout userName={userName} activeTab="settings">
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Global Settings</h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure system-wide policies like grade advancement.
              </p>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading settings...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Application timezone</label>
                  <select value={settings.appTimezone} onChange={(e) => setSettings((prev) => ({ ...prev, appTimezone: e.target.value }))} className="w-full max-w-xl border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    {APP_TIMEZONES.map((timezone) => <option key={timezone.value} value={timezone.value}>{timezone.label} ({timezone.value})</option>)}
                  </select>
                  <p className="mt-2 text-xs text-gray-500">Business dates such as registration windows use this timezone. Stored timestamps remain UTC.</p>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Handbooks</h2>
                  <p className="mt-1 text-sm text-gray-600">Upload PDF handbooks and publish one active version. Previously uploaded handbooks remain available below.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PDF file</label>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => setHandbookFile(event.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
                      <input
                        type="text"
                        value={handbookVersion}
                        onChange={(event) => setHandbookVersion(event.target.value)}
                        placeholder="2026-2027"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <button type="button" onClick={uploadHandbook} disabled={isUploading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                      {isUploading ? 'Uploading...' : 'Upload PDF'}
                    </button>
                  </div>
                  <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Version</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">File</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Uploaded</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {handbooks.map((handbook) => (
                          <tr key={handbook.id}>
                            <td className="px-3 py-3 font-medium text-gray-900">{handbook.version}</td>
                            <td className="px-3 py-3"><a href={handbook.blobUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">{handbook.filename}</a></td>
                            <td className="px-3 py-3 text-gray-600">{new Date(handbook.uploadedAt).toLocaleDateString()}</td>
                            <td className="px-3 py-3 text-right">
                              {handbook.isActive ? (
                                <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">Active</span>
                              ) : (
                                <button type="button" onClick={() => publishHandbook(handbook.id)} disabled={isPublishing !== null} className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                                  {isPublishing === handbook.id ? 'Publishing...' : 'Set active'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {handbooks.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No handbooks uploaded yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Publishing a different version makes it the only active handbook and requires users to acknowledge that version again.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New registration notification emails</label>
                  <input
                    type="text"
                    value={settings.registrationNotificationEmails}
                    onChange={(e) => setSettings((prev) => ({ ...prev, registrationNotificationEmails: e.target.value }))}
                    placeholder="admin@example.com, staff@example.com"
                    className="w-full max-w-xl border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-2 text-xs text-gray-500">Comma-separated addresses that receive an email when a new account is registered.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Class teaching request notification emails</label>
                  <input
                    type="text"
                    value={settings.classRequestNotificationEmails}
                    onChange={(e) => setSettings((prev) => ({ ...prev, classRequestNotificationEmails: e.target.value }))}
                    placeholder="admin@example.com, curriculum@example.com"
                    className="w-full max-w-xl border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-2 text-xs text-gray-500">Comma-separated addresses that receive an email when a parent submits a request to teach a class.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade Increment Date
                  </label>
                  <input
                    type="date"
                    value={settings.incrementDate}
                    onChange={(e) => setSettings((prev) => ({ ...prev, incrementDate: e.target.value }))}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Grades will increment on this date each year. Students in 12th grade advance to Graduated.
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Last run:</span> {settings.lastRun || 'Not yet run'}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                  >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                  <button
                    onClick={handleRunNow}
                    disabled={isRunning}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                  >
                    {isRunning ? 'Running...' : 'Run Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </AdminLayout>
  )
}
