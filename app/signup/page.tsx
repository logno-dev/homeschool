'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import BrandLogo from '@/app/components/BrandLogo'
import AcknowledgementFields from '@/app/components/AcknowledgementFields'
import { GRADE_ORDER, GRADUATED_LABEL, PRE_K_LABEL } from '@/lib/grades'

type ChildDraft = { firstName: string; lastName: string; dateOfBirth: string; grade: string }
const gradeOptions = [PRE_K_LABEL, ...GRADE_ORDER, GRADUATED_LABEL]
const emptyChild = (): ChildDraft => ({ firstName: '', lastName: '', dateOfBirth: '', grade: '' })

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', familyName: '', familyAddress: '', familyPhone: '', familyCode: '' })
  const [familyMode, setFamilyMode] = useState<'create' | 'join'>('create')
  const [familyChildren, setFamilyChildren] = useState<ChildDraft[]>([emptyChild()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [handbook, setHandbook] = useState({ url: '', version: '' })
  const [releaseLiabilityAgreed, setReleaseLiabilityAgreed] = useState(false)
  const [contactInfoRelease, setContactInfoRelease] = useState<'agree' | 'do_not_agree' | ''>('')
  const [photographyRelease, setPhotographyRelease] = useState<'agree' | 'do_not_agree' | ''>('')
  const [handbookAgreed, setHandbookAgreed] = useState(false)

  useEffect(() => { fetch('/api/auth/acknowledgements').then((response) => response.json()).then((payload) => setHandbook({ url: payload.handbookUrl || '', version: payload.handbookVersion || '' })).catch(() => setHandbook({ url: '', version: '' })) }, [])

  const updateChild = (index: number, field: keyof ChildDraft, value: string) => setFamilyChildren((current) => current.map((child, childIndex) => childIndex === index ? { ...child, [field]: value } : child))
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, familyMode, familyChildren: familyMode === 'create' ? familyChildren : [], releaseLiabilityAgreed, contactInfoRelease, photographyRelease, handbookAgreed }) })
      const payload = await response.json()
      if (!response.ok) { setError(payload.error || 'Unable to create account'); return }
      router.push('/signin?pending=1')
    } catch { setError('Unable to create account') } finally { setLoading(false) }
  }

  return <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4"><div className="w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm"><div className="mb-4 flex justify-center"><BrandLogo variant="icon" width={64} alt="DVCLC" /></div><h1 className="text-2xl font-semibold text-gray-900">Create account</h1><p className="mt-2 text-sm text-gray-600">Set up your DVCLC login and family profile.</p>
    <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-gray-700">First name<input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-gray-700">Last name<input required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
      <label className="block text-sm font-medium text-gray-700">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
      <fieldset className="rounded-md border border-gray-200 bg-gray-50 p-4"><legend className="px-1 text-sm font-semibold text-gray-900">Family information</legend><div className="mt-2 flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" checked={familyMode === 'create'} onChange={() => setFamilyMode('create')} />Create a new family</label><label className="flex items-center gap-2"><input type="radio" checked={familyMode === 'join'} onChange={() => setFamilyMode('join')} />Join an existing family</label></div>{familyMode === 'join' ? <label className="mt-4 block text-sm font-medium text-gray-700">Family code<input required value={form.familyCode} onChange={(event) => setForm({ ...form, familyCode: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label> : <div className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Family name<input required value={form.familyName} onChange={(event) => setForm({ ...form, familyName: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-gray-700">Family phone<input required value={form.familyPhone} onChange={(event) => setForm({ ...form, familyPhone: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div><label className="block text-sm font-medium text-gray-700">Family address<input required value={form.familyAddress} onChange={(event) => setForm({ ...form, familyAddress: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><div className="border-t border-gray-200 pt-3"><p className="text-sm font-medium text-gray-700">Children</p>{familyChildren.map((child, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-4"><input required placeholder="First name" value={child.firstName} onChange={(event) => updateChild(index, 'firstName', event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" /><input required placeholder="Last name" value={child.lastName} onChange={(event) => updateChild(index, 'lastName', event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" /><input required type="date" value={child.dateOfBirth} onChange={(event) => updateChild(index, 'dateOfBirth', event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" /><select required value={child.grade} onChange={(event) => updateChild(index, 'grade', event.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Select grade</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></div>)}<button type="button" onClick={() => setFamilyChildren((current) => [...current, emptyChild()])} className="mt-2 text-sm font-medium text-blue-600">Add another child</button></div></div>}</fieldset>
      <AcknowledgementFields releaseLiabilityAgreed={releaseLiabilityAgreed} contactInfoRelease={contactInfoRelease} photographyRelease={photographyRelease} handbookAgreed={handbookAgreed} handbookUrl={handbook.url} handbookVersion={handbook.version} onReleaseLiabilityChange={setReleaseLiabilityAgreed} onContactInfoReleaseChange={setContactInfoRelease} onPhotographyReleaseChange={setPhotographyRelease} onHandbookChange={setHandbookAgreed} />
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-gray-700">Password<input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-gray-700">Confirm password<input required minLength={8} type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label></div>
      {error && <p className="text-sm text-red-600">{error}</p>}<button type="submit" disabled={loading} className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400">{loading ? 'Creating account...' : 'Create account'}</button>
    </form><div className="mt-4 text-sm text-gray-600">Already have an account? <Link href="/signin" className="text-blue-600 hover:text-blue-800">Sign in</Link></div>
  </div></div>
}
