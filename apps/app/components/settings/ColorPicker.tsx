"use client"

import { HexColorPicker, HexColorInput } from "react-colorful"
import { useState, useRef, useEffect } from "react"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label: string
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative flex items-center gap-3" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
      >
        <span
          className="inline-block size-4 rounded-sm border border-border"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-xs">{value}</span>
      </button>
      <span className="text-sm text-muted-foreground">{label}</span>
      {open && (
        <div className="absolute left-0 top-10 z-50 rounded-xl border border-border bg-popover p-3 shadow-lg">
          <HexColorPicker color={value} onChange={onChange} />
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">#</span>
            <HexColorInput
              color={value}
              onChange={onChange}
              prefixed={false}
              className="h-7 w-24 rounded-md border border-input bg-transparent px-2 text-xs font-mono outline-none focus:border-ring"
            />
          </div>
        </div>
      )}
    </div>
  )
}
