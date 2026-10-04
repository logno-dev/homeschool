'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

interface SearchSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export default function SearchSelect({ label, value, options, onChange, placeholder = 'Search and select…', disabled = false, required = false, className = '' }: SearchSelectProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find((option) => option.value === value)
  const filtered = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const expanded = open && !disabled

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !selected ? `Select ${label.toLowerCase()} from the list.` : '')
  }, [required, selected, label])

  useEffect(() => {
    if (expanded) listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, expanded])

  useEffect(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }, [value, disabled])

  const choose = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <label htmlFor={id} className="block text-sm">{label}</label>
      <div className="relative mt-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${id}-options`}
          aria-required={required}
          aria-activedescendant={expanded && filtered[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={expanded ? query : selected?.label || ''}
          placeholder={expanded ? 'Type to search…' : placeholder}
          title={selected?.label}
          onFocus={() => { setQuery(''); setActiveIndex(0); setOpen(true) }}
          onClick={() => { if (!open) { setQuery(''); setActiveIndex(0); setOpen(true) } }}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true) }}
          onBlur={() => { setOpen(false); setQuery('') }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!expanded) { setQuery(''); setActiveIndex(0); setOpen(true); return }
              setActiveIndex((index) => Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
            } else if (event.key === 'Enter' && expanded) {
              event.preventDefault()
              if (filtered[activeIndex]) choose(filtered[activeIndex].value)
            } else if (event.key === 'Escape' && expanded) {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
            }
          }}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        />
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
      </div>
      {expanded && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <ul ref={listRef} id={`${id}-options`} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto py-1">
            {filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
                className={`flex cursor-pointer items-start justify-between gap-3 px-3 py-2.5 text-sm ${index === activeIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700'}`}
              >
                <span className="min-w-0 break-words">{option.label}</span>
                {option.value === value && <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
              </li>
            ))}
          </ul>
          {!filtered.length && <p role="status" className="px-3 py-4 text-sm text-gray-500">No matching options.</p>}
        </div>
      )}
    </div>
  )
}
