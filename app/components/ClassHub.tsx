'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { RICH_TEXT_EDITOR_FORMATS, RICH_TEXT_EDITOR_MODULES } from '@/lib/rich-text-editor'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false, loading: () => <p className="p-3 text-sm text-gray-500">Loading editor...</p> })

type Attachment = { id: string; filename: string; contentType: string; size: number }
type FeedbackResponse = { id: string; body: string; familyId: string; familyName: string; updatedAt: string }
type Post = { id: string; type: 'note' | 'resource' | 'feedback'; title: string; bodyHtml: string; authorName: string; publishedAt: string; attachments: Attachment[]; responses: FeedbackResponse[] }
type Message = { id: string; body: string; authorName: string; isOwn: boolean; createdAt: string }
type Thread = { id: string; subject: string; familyName: string; status: string; updatedAt: string; messages: Message[] }
type HubData = { access: { canManage: boolean; isFamily: boolean; familyId: string | null }; classInfo: { className: string; gradeRange: string; period: string; classroomName: string | null; sessionName: string }; posts: Post[]; threads: Thread[] }

const PERIOD_NAMES: Record<string, string> = { first: 'First Hour', second: 'Second Hour', lunch: 'Lunch', third: 'Third Hour' }

export default function ClassHub({ scheduleId }: { scheduleId: string }) {
  const [data, setData] = useState<HubData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [postForm, setPostForm] = useState({ type: 'note', title: '', bodyHtml: '' })
  const [postFiles, setPostFiles] = useState<File[]>([])
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [question, setQuestion] = useState({ subject: '', message: '' })
  const [replies, setReplies] = useState<Record<string, string>>({})

  const load = async () => {
    setError('')
    const response = await fetch(`/api/class-hub/${scheduleId}`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load class hub')
    setData(payload)
    const ownFeedback: Record<string, string> = {}
    for (const post of payload.posts || []) {
      const response = post.responses?.find((item: FeedbackResponse) => item.familyId === payload.access.familyId)
      if (response) ownFeedback[post.id] = response.body
    }
    setFeedback(ownFeedback)
  }

  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load class hub')) }, [scheduleId])

  const publish = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/class-hub/${scheduleId}/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postForm) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to publish')
      for (const file of postFiles) {
        const formData = new FormData()
        formData.set('postId', payload.post.id)
        formData.set('file', file)
        const upload = await fetch(`/api/class-hub/${scheduleId}/attachments`, { method: 'POST', body: formData })
        if (!upload.ok) { const uploadPayload = await upload.json(); throw new Error(uploadPayload.error || `Unable to upload ${file.name}`) }
      }
      setPostForm({ type: 'note', title: '', bodyHtml: '' })
      setPostFiles([])
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to publish') } finally { setBusy(false) }
  }

  const submitFeedback = async (postId: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/class-hub/${scheduleId}/posts/${postId}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: feedback[postId] || '' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save feedback')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save feedback') } finally { setBusy(false) }
  }

  const askQuestion = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/class-hub/${scheduleId}/threads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(question) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to send question')
      setQuestion({ subject: '', message: '' })
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send question') } finally { setBusy(false) }
  }

  const reply = async (threadId: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/class-hub/${scheduleId}/threads/${threadId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: replies[threadId] || '' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to send reply')
      setReplies((current) => ({ ...current, [threadId]: '' }))
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send reply') } finally { setBusy(false) }
  }

  if (error && !data) return <main className="mx-auto max-w-4xl px-4 py-10"><div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">{error}</div></main>
  if (!data) return <main className="mx-auto max-w-4xl px-4 py-10 text-gray-500">Loading class hub...</main>

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <header className="rounded-2xl bg-slate-900 px-6 py-6 text-white shadow-lg">
      <Link href={data.access.canManage ? '/teacher' : '/schedule'} className="text-sm text-blue-200 hover:text-white">Back to {data.access.canManage ? 'Teacher Dashboard' : 'Family Schedule'}</Link>
      <h1 className="mt-3 text-3xl font-bold">{data.classInfo.className}</h1>
      <p className="mt-2 text-slate-300">{data.classInfo.sessionName} | {PERIOD_NAMES[data.classInfo.period] || data.classInfo.period}{data.classInfo.classroomName ? ` | ${data.classInfo.classroomName}` : ''} | {data.classInfo.gradeRange}</p>
    </header>

    {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

    {data.access.canManage && <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Publish to Families</h2>
      <form onSubmit={publish} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-gray-700">Post Type<select value={postForm.type} onChange={(event) => setPostForm({ ...postForm, type: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"><option value="note">Class Note</option><option value="resource">Resource</option><option value="feedback">Feedback Request</option></select></label><label className="sm:col-span-2 text-sm font-medium text-gray-700">Title<input required maxLength={160} value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
        <div className="class-hub-editor"><ReactQuill theme="snow" value={postForm.bodyHtml} onChange={(bodyHtml) => setPostForm({ ...postForm, bodyHtml })} modules={RICH_TEXT_EDITOR_MODULES} formats={RICH_TEXT_EDITOR_FORMATS} /></div>
        <label className="block text-sm font-medium text-gray-700">Attachments<input type="file" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" onChange={(event) => setPostFiles(Array.from(event.target.files || []))} className="mt-1 block w-full text-sm font-normal" /><span className="mt-1 block text-xs text-gray-500">PDF, DOCX, PNG, or JPEG. Maximum 10 MB each.</span></label>
        <button disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Publishing...' : 'Publish'}</button>
      </form>
    </section>}

    <section className="space-y-4">
      <div><h2 className="text-xl font-semibold text-gray-900">Class Updates & Resources</h2><p className="text-sm text-gray-600">Notes and files shared with enrolled families.</p></div>
      {data.posts.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">Nothing has been posted yet.</div> : data.posts.map((post) => <article key={post.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${post.type === 'feedback' ? 'bg-purple-100 text-purple-800' : post.type === 'resource' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{post.type === 'feedback' ? 'Feedback requested' : post.type === 'resource' ? 'Resource' : 'Class note'}</span><h3 className="mt-2 text-lg font-semibold text-gray-900">{post.title}</h3></div><p className="text-xs text-gray-500">{post.authorName} | {new Date(post.publishedAt).toLocaleDateString()}</p></div>
        <div className="event-rich-text mt-4 text-gray-700" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
        {post.attachments.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{post.attachments.map((file) => <a key={file.id} href={`/api/class-hub/${scheduleId}/attachments/${file.id}`} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">Download {file.filename}</a>)}</div>}
        {post.type === 'feedback' && data.access.isFamily && <div className="mt-5 rounded-lg bg-purple-50 p-4"><label className="block text-sm font-medium text-purple-950">Your family&apos;s response<textarea rows={3} value={feedback[post.id] || ''} onChange={(event) => setFeedback({ ...feedback, [post.id]: event.target.value })} className="mt-2 block w-full rounded-md border border-purple-200 bg-white px-3 py-2 font-normal" /></label><button type="button" disabled={busy || !(feedback[post.id] || '').trim()} onClick={() => submitFeedback(post.id)} className="mt-3 rounded-md bg-purple-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Response</button></div>}
        {post.type === 'feedback' && data.access.canManage && <div className="mt-5 border-t pt-4"><h4 className="text-sm font-semibold text-gray-900">Family Responses ({post.responses.length})</h4>{post.responses.length === 0 ? <p className="mt-2 text-sm text-gray-500">No responses yet.</p> : <div className="mt-2 space-y-2">{post.responses.map((response) => <div key={response.id} className="rounded-md bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-600">{response.familyName}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{response.body}</p></div>)}</div>}</div>}
      </article>)}
    </section>

    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Private Questions</h2>
      <p className="mt-1 text-sm text-gray-600">Questions are visible only to the family, assigned teachers, and authorized administrators.</p>
      {data.access.isFamily && <form onSubmit={askQuestion} className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4"><input required maxLength={160} value={question.subject} onChange={(event) => setQuestion({ ...question, subject: event.target.value })} placeholder="Question subject" className="block w-full rounded-md border border-gray-300 px-3 py-2" /><textarea required rows={3} value={question.message} onChange={(event) => setQuestion({ ...question, message: event.target.value })} placeholder="Ask the teachers a question" className="block w-full rounded-md border border-gray-300 px-3 py-2" /><button disabled={busy} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send Question</button></form>}
      <div className="mt-5 space-y-4">{data.threads.length === 0 ? <p className="text-sm text-gray-500">No questions yet.</p> : data.threads.map((thread) => <article key={thread.id} className="rounded-lg border border-gray-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-gray-900">{thread.subject}</h3>{data.access.canManage && <p className="text-xs text-gray-500">From {thread.familyName}</p>}</div><span className="text-xs text-gray-500">{thread.status}</span></div><div className="mt-4 space-y-2">{thread.messages.map((message) => <div key={message.id} className={`rounded-lg px-3 py-2 ${message.isOwn ? 'ml-8 bg-blue-50' : 'mr-8 bg-gray-100'}`}><p className="text-xs font-semibold text-gray-600">{message.authorName}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{message.body}</p><p className="mt-1 text-[11px] text-gray-400">{new Date(message.createdAt).toLocaleString()}</p></div>)}</div><div className="mt-3 flex gap-2"><input value={replies[thread.id] || ''} onChange={(event) => setReplies({ ...replies, [thread.id]: event.target.value })} placeholder="Write a reply" className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" /><button type="button" disabled={busy || !(replies[thread.id] || '').trim()} onClick={() => reply(thread.id)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Reply</button></div></article>)}</div>
    </section>
  </main>
}
