"use client"

import { useState } from "react"
import { ReadinessPanel } from "@/app/widget/ReadinessPanel"
import type { ReadinessResponse } from "@/app/widget/useActivation"

const THEMES = {
  dark: { primary: "#6366f1", onPrimary: "#ffffff", text: "#f4f4f5", background: "#0a0a0f", bgIsLight: false },
  light: { primary: "#0f766e", onPrimary: "#ffffff", text: "#111111", background: "#ffffff", bgIsLight: true },
} as const

export function ActivationDemoGrid({
  projectName,
  scenarios,
}: {
  projectName: string
  scenarios: { title: string; note: string; readiness: ReadinessResponse }[]
}) {
  const [theme, setTheme] = useState<keyof typeof THEMES>("dark")
  const [asked, setAsked] = useState<string | null>(null)
  const p = THEMES[theme]

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Branch preview, fixtures only</p>
        <h1 className="mt-1 text-2xl font-bold">Readiness check</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Each panel below is the real widget component, and each checklist is written by the real builder from fixture wallet facts.
          Only the chain reads are replaced. The prompt is what appears beside the chat button when a new wallet connects.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Widget theme" className="inline-flex rounded-lg border border-neutral-300 p-0.5 dark:border-neutral-700">
            {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map(t => (
              <button
                key={t}
                role="radio"
                aria-checked={theme === t}
                onClick={() => setTheme(t)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${theme === t ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : ""}`}
              >
                {t === "dark" ? "Dark widget" : "Light widget"}
              </button>
            ))}
          </div>
          {asked && <p className="text-xs text-neutral-600 dark:text-neutral-400">Would send to the chat: <span className="font-mono">{asked}</span></p>}
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-semibold">The prompt</h2>
          <div className="mt-3 flex items-end justify-end gap-2.5 rounded-xl bg-neutral-800 p-6" style={{ minHeight: 120 }}>
            <div className="flex max-w-[260px] items-start gap-1.5 rounded-xl bg-[#17172a] py-2 pl-3 pr-2 text-[13px] font-medium leading-snug text-white shadow-lg">
              <span>Getting started? Check your wallet is ready for your first deposit.</span>
              <span className="px-0.5 text-base leading-none opacity-60" aria-hidden>&times;</span>
            </div>
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full shadow-lg" style={{ backgroundColor: p.primary }} aria-hidden>
              <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map(s => (
            <section key={s.title}>
              <h2 className="text-sm font-semibold">{s.title}</h2>
              <p className="mt-0.5 min-h-[2.5rem] text-xs text-neutral-600 dark:text-neutral-400">{s.note}</p>
              <div
                className="relative mt-2 w-full max-w-[380px] overflow-hidden rounded-2xl shadow-xl"
                style={{ height: 560, backgroundColor: p.background }}
              >
                <ReadinessPanel
                  readiness={s.readiness}
                  palette={p}
                  projectName={projectName}
                  onAsk={q => setAsked(q)}
                  onBack={() => setAsked("(back to chat)")}
                />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
