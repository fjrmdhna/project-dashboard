'use client'

import { useEffect, useRef, useState } from 'react'
import { PRESET_LABEL, type RangePreset } from '@/lib/sanitation-report/aggregate'

export type DateSelection = { preset: RangePreset | null; from: string; to: string }

type Props = {
  value: DateSelection
  /** Batas bawah/atas yang dipilih di kalender (YYYY-MM-DD). */
  min: string
  max: string
  label: string
  onChange: (v: DateSelection) => void
}

const PRESETS = Object.keys(PRESET_LABEL) as RangePreset[]

export function DateFilter({ value, min, max, label, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value.from)
  const [to, setTo] = useState(value.to)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFrom(value.from)
    setTo(value.to)
  }, [value.from, value.to])

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

  const invalid = !!from && !!to && from > to
  const applyCustom = () => {
    if (invalid || (!from && !to)) return
    onChange({ preset: null, from, to })
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
      >
        <span>
          <span className="mr-1 font-normal text-slate-500">Created:</span>
          {label}
        </span>
        <span aria-hidden className="text-slate-500">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Date filter"
          className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={value.preset === p}
                onClick={() => {
                  onChange({ preset: p, from: '', to: '' })
                  setOpen(false)
                }}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${
                  value.preset === p
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {PRESET_LABEL[p]}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">Custom range</p>
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-slate-600">
                From
                <input
                  type="date"
                  value={from}
                  min={min}
                  max={to || max}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                />
              </label>
              <label className="flex-1 text-xs text-slate-600">
                To
                <input
                  type="date"
                  value={to}
                  min={from || min}
                  max={max}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                />
              </label>
            </div>
            {invalid && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                “From” must be on or before “To”.
              </p>
            )}
            <button
              type="button"
              onClick={applyCustom}
              disabled={invalid || (!from && !to)}
              className="mt-2 w-full rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

