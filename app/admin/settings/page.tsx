'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useRouter } from 'next/navigation'
import AdminLayout from '../../components/AdminLayout'
import { useToast } from '../../components/ToastContainer'

interface SettingsState {
  incrementDate: string
  lastRun: string | null
}

export default function AdminSettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showSuccess, showError } = useToast()
  const [settings, setSettings] = useState<SettingsState>({ incrementDate: '', lastRun: null })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

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
          lastRun: result.lastRun || null
        })
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
        body: JSON.stringify({ gradeIncrementDate: settings.incrementDate || null })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save settings')
      }
      showSuccess('Settings saved', 'Grade increment schedule updated.')
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
