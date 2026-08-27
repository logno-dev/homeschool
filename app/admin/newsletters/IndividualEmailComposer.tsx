'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })
type User = { id: string; firstName: string; lastName: string; email: string }

export default function IndividualEmailComposer({ users, aliases, initialUserId }: { users: User[]; aliases: string[]; initialUserId?: string }) {
  const [userId, setUserId] = useState(initialUserId || '')
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [senderAlias, setSenderAlias] = useState('')
  const [replyToAlias, setReplyToAlias] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [status, setStatus] = useState('')
  const selectedUser = users.find((user) => user.id === userId)
  const matches = useMemo(() => users.filter((user) => `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8), [users, search])

  const send = async () => {
    const response = await fetch('/api/admin/messaging/individual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, cc, bcc, subject, html, text: html.replace(/<[^>]+>/g, ' '), senderAlias: senderAlias || undefined, replyToAlias: replyToAlias || undefined }) })
    const payload = await response.json()
    setStatus(response.ok ? 'Email sent' : payload.error || 'Unable to send email')
  }

  return <div className="mt-5 space-y-5">
    <label className="block text-sm font-medium text-gray-700">To<div className="relative mt-1"><input value={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})` : search} onChange={(event) => { setUserId(''); setSearch(event.target.value) }} placeholder="Search users by name or email" className="block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" />{!selectedUser && search && matches.length > 0 && <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">{matches.map((user) => <button type="button" key={user.id} onClick={() => { setUserId(user.id); setSearch('') }} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">{user.firstName} {user.lastName}<span className="ml-2 text-gray-500">{user.email}</span></button>)}</div>}</div></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">From<select value={senderAlias} onChange={(event) => setSenderAlias(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">Use configured default</option>{aliases.map((alias) => <option key={alias} value={alias}>{alias}</option>)}</select></label><label className="text-sm font-medium text-gray-700">Reply-to<select value={replyToAlias} onChange={(event) => setReplyToAlias(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="">No reply-to address</option>{aliases.map((alias) => <option key={alias} value={alias}>{alias}</option>)}</select></label><label className="text-sm font-medium text-gray-700">CC<input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="person@example.com, team@example.com" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-gray-700">BCC<input value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="person@example.com, team@example.com" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
    <label className="block text-sm font-medium text-gray-700">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
    <div><label className="block text-sm font-medium text-gray-700">Body</label><div className="mt-1 overflow-hidden rounded-md border border-gray-300"><ReactQuill theme="snow" value={html} onChange={setHtml} /></div></div>
    <button type="button" onClick={send} disabled={!userId || !subject.trim() || !html.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send email</button>{status && <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">{status}</p>}
  </div>
}
