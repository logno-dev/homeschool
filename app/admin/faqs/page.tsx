'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/app/components/AdminLayout'

type Visibility = 'public' | 'private'

interface Faq {
  id: string
  question: string
  answer: string
  visibility: Visibility
  orderIndex: number
}

export default function AdminFaqsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [tab, setTab] = useState<Visibility>('public')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [orderIndex, setOrderIndex] = useState('0')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadFaqs = async () => {
    const response = await fetch('/api/admin/faqs')
    if (!response.ok) throw new Error('Failed to load FAQs')
    const payload = await response.json()
    setFaqs(payload.faqs || [])
  }

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/signin')
      return
    }
    loadFaqs().catch(() => setMessage('Unable to load FAQs')).finally(() => setIsLoading(false))
  }, [loading, user, router])

  const resetForm = () => {
    setEditingId(null)
    setQuestion('')
    setAnswer('')
    setOrderIndex('0')
  }

  const saveFaq = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const response = await fetch(editingId ? `/api/admin/faqs/${editingId}` : '/api/admin/faqs', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, visibility: tab, orderIndex: Number(orderIndex) || 0 })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to save FAQ')
      if (editingId) {
        setFaqs((current) => current.map((faq) => faq.id === editingId ? payload.faq : faq))
      } else {
        setFaqs((current) => [...current, payload.faq])
      }
      resetForm()
      setMessage('FAQ saved')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save FAQ')
    } finally {
      setIsSaving(false)
    }
  }

  const editFaq = (faq: Faq) => {
    setEditingId(faq.id)
    setQuestion(faq.question)
    setAnswer(faq.answer)
    setOrderIndex(String(faq.orderIndex))
  }

  const deleteFaq = async (faq: Faq) => {
    if (!confirm(`Delete this FAQ?`)) return
    const response = await fetch(`/api/admin/faqs/${faq.id}`, { method: 'DELETE' })
    if (response.ok) {
      setFaqs((current) => current.filter((entry) => entry.id !== faq.id))
      if (editingId === faq.id) resetForm()
      setMessage('FAQ deleted')
    } else {
      setMessage('Failed to delete FAQ')
    }
  }

  const visibleFaqs = faqs.filter((faq) => faq.visibility === tab).sort((a, b) => a.orderIndex - b.orderIndex)
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Admin'

  if (loading || isLoading || !user) return <div className="min-h-screen bg-gray-50" />

  return (
    <AdminLayout userName={userName} activeTab="faqs">
      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">FAQ Management</h1>
            <p className="mt-1 text-sm text-gray-600">Manage separate FAQs for public visitors and authenticated families.</p>
          </div>
          <div className="mb-6 flex border-b border-gray-200">
            {(['public', 'private'] as Visibility[]).map((value) => (
              <button key={value} onClick={() => { setTab(value); resetForm() }} className={`px-4 py-3 text-sm font-medium ${tab === value ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
                {value === 'public' ? 'Public FAQs' : 'Private FAQs'}
              </button>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="space-y-3">
              {visibleFaqs.map((faq) => (
                <article key={faq.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="font-semibold text-gray-900">{faq.question}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{faq.answer}</p></div>
                    <div className="flex shrink-0 gap-2"><button onClick={() => editFaq(faq)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button><button onClick={() => deleteFaq(faq)} className="text-sm text-red-600 hover:text-red-800">Delete</button></div>
                  </div>
                </article>
              ))}
              {visibleFaqs.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No {tab} FAQs yet.</div>}
            </section>
            <form onSubmit={saveFaq} className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900">{editingId ? 'Edit FAQ' : 'Add FAQ'}</h2>
              <label className="mt-4 block text-sm font-medium text-gray-700">Question<input value={question} onChange={(event) => setQuestion(event.target.value)} required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="mt-4 block text-sm font-medium text-gray-700">Answer<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} required rows={7} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="mt-4 block text-sm font-medium text-gray-700">Order<input type="number" value={orderIndex} onChange={(event) => setOrderIndex(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
              <div className="mt-5 flex gap-2"><button type="submit" disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add FAQ'}</button>{editingId && <button type="button" onClick={resetForm} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancel</button>}</div>
            </form>
          </div>
        </div>
      </main>
    </AdminLayout>
  )
}
