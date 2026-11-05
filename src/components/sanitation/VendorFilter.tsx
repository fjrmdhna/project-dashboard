'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type VendorOption = { code: string; name: string }

type Props = {
  options: VendorOption[]
  selected: string[]
  onChange: (codes: string[]) => void
}

export function VendorFilter({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? options.filter((o) => o.name.toLowerCase().includes(s) || o.code.toLowerCase().includes(s)) : options
  }, [options, q])

  const sel = new Set(selected)
  const toggle = (code: string) =>
    onChange(sel.has(code) ? selected.filter((c) => c !== code) : [...selected, code])
  const names = selected.map((c) => options.find((o) => o.code === c)?.name ?? c)
  const label =
    selected.length === 0 ? 'All vendors' : names.length <= 2 ? names.join(', ') : `${names.length} vendors selected`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-56 max-w-xs items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
      >
        <span className="truncate">
          <span className="mr-1 font-normal text-slate-500">Vendor:</span>
          {label}
        </span>
        <span aria-hidden className="text-slate-500">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendor…"
            aria-label="Search vendor"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-600">{selected.length ? `${selected.length} selected` : 'All vendors'}</span>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!selected.length}
              className="font-semibold text-teal-700 hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              Clear
            </button>
          </div>
          <ul id={listId} role="listbox" aria-multiselectable="true" aria-label="Vendors" className="mt-1 max-h-72 overflow-auto">
            {filtered.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">No vendor found.</li>}
            {filtered.map((o) => {
              const on = sel.has(o.code)
              return (
                <li key={o.code} role="option" aria-selected={on}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(o.code)}
                      className="h-4 w-4 accent-teal-700"
                    />
                    <span className="truncate">{o.name}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

