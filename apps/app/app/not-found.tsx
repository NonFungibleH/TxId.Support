import Link from "next/link"
import { ArrowRight, LifeBuoy } from "lucide-react"

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://txid.support"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/txid-icon-64.png" alt="TxID Support" className="mx-auto h-10 w-10" />

        <p className="mt-6 text-5xl font-bold tracking-tight">404</p>
        <h1 className="mt-2 text-lg font-semibold">This page isn&apos;t available</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The page may have moved, or you might not have access to it. Let&apos;s get you back on track.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Back to dashboard
            <ArrowRight className="size-4" />
          </Link>
          <a
            href={`${WEB_URL}/docs`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LifeBuoy className="size-4" />
            Help center
          </a>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Still stuck?{" "}
          <a href="mailto:team@txid.support" className="text-primary hover:underline">
            team@txid.support
          </a>
        </p>
      </div>
    </div>
  )
}
