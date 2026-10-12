'use client'

import { useState } from 'react'
import type { ClassCategory } from '@/lib/schema'

export default function ClassCategoryManager({ initialCategories, onChange }: { initialCategories: ClassCategory[]; onChange?: (categories: ClassCategory[]) => void }) {
  const [categories, setCategories] = useState(initialCategories)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const response = await fetch('/api/admin/class-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) { setMessage(payload.error || 'Unable to add category'); return }
    const next = [...categories, payload.category]
    setCategories(next)
    onChange?.(next)
    setName('')
  }

  const toggleCategory = async (category: ClassCategory) => {
    const response = await fetch(`/api/admin/class-categories/${category.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !category.isActive }) })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'Unable to update category'); return }
    const next = categories.map((item) => item.id === category.id ? payload.category : item)
    setCategories(next)
    onChange?.(next)
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow">
      <div><h2 className="text-lg font-semibold text-gray-900">Class Categories</h2><p className="text-sm text-gray-600">Active categories are available to parents when they propose classes.</p></div>
      <form onSubmit={addCategory} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="New category or subject" className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2" />
        <button disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add Category</button>
      </form>
      {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => <button key={category.id} type="button" onClick={() => toggleCategory(category)} className={`rounded-full border px-3 py-1.5 text-sm ${category.isActive ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-100 text-gray-500 line-through'}`}>{category.name} <span className="text-xs">({category.isActive ? 'active' : 'inactive'})</span></button>)}
        {categories.length === 0 && <p className="text-sm text-gray-500">No categories configured yet.</p>}
      </div>
    </section>
  )
}
