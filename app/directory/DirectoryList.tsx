'use client'

import { useMemo, useState } from 'react'

export type DirectoryAdult = {
  id: string
  firstName: string
  lastName: string
}

export type DirectoryChild = {
  id: string
  firstName: string
  lastName: string
  grade: string
}

export type DirectoryFamily = {
  id: string
  name: string
  adults: DirectoryAdult[]
  children: DirectoryChild[]
}

const searchableName = (person: DirectoryAdult | DirectoryChild) =>
  `${person.firstName} ${person.lastName} ${person.lastName} ${person.firstName}`.toLocaleLowerCase()

export default function DirectoryList({ families, unlinkedAdults }: { families: DirectoryFamily[]; unlinkedAdults: DirectoryAdult[] }) {
  const [query, setQuery] = useState('')
  const terms = useMemo(() => query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), [query])

  const filteredFamilies = useMemo(() => {
    if (terms.length === 0) return families
    return families.filter((family) => {
      const searchable = [
        family.name.toLocaleLowerCase(),
        ...family.adults.map(searchableName),
        ...family.children.map(searchableName),
      ].join(' ')
      return terms.every((term) => searchable.includes(term))
    })
  }, [families, terms])

  const filteredUnlinkedAdults = useMemo(() => {
    if (terms.length === 0) return unlinkedAdults
    return unlinkedAdults.filter((adult) => terms.every((term) => searchableName(adult).includes(term)))
  }, [terms, unlinkedAdults])

  const hasResults = filteredFamilies.length > 0 || filteredUnlinkedAdults.length > 0

  return (
    <section className="mt-8">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="directory-search" className="block text-sm font-semibold text-slate-900">Search the directory</label>
        <div className="relative mt-2">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by parent or child name"
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-10 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear directory search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">Clear</button>}
        </div>
        {terms.length > 0 && <p className="mt-2 text-sm text-slate-600" aria-live="polite">{filteredFamilies.length + filteredUnlinkedAdults.length} {filteredFamilies.length + filteredUnlinkedAdults.length === 1 ? 'result' : 'results'}</p>}
      </div>

      {hasResults ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredFamilies.map((family) => (
            <article key={family.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
                <h2 className="text-lg font-bold text-blue-950">{family.name}</h2>
              </div>
              <div className="space-y-5 p-5">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Adults</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-900">
                    {family.adults.map((adult) => <li key={adult.id}>{adult.firstName} {adult.lastName}</li>)}
                  </ul>
                </section>
                {family.children.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Children</h3>
                    <ul className="mt-2 divide-y divide-slate-100">
                      {family.children.map((child) => (
                        <li key={child.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                          <span className="text-sm text-slate-900">{child.firstName} {child.lastName}</span>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{child.grade === 'Grade not listed' ? child.grade : `Grade ${child.grade}`}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </article>
          ))}

          {filteredUnlinkedAdults.length > 0 && (
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-100 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Community Members</h2></div>
              <ul className="space-y-2 p-5 text-sm text-slate-900">
                {filteredUnlinkedAdults.map((adult) => <li key={adult.id}>{adult.firstName} {adult.lastName}</li>)}
              </ul>
            </article>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No matching members</h2>
          <p className="mt-2 text-sm text-slate-600">Try another parent or child name.</p>
          <button type="button" onClick={() => setQuery('')} className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Clear Search</button>
        </div>
      )}
    </section>
  )
}
