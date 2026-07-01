import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { Button } from "@/components/ui/Button"

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center pt-16">
        <div className="text-center px-6">
          <p className="font-mono text-sm text-accent mb-4">{'// 404'}</p>
          <h1 className="font-display text-6xl font-bold text-white mb-4">
            Page not found
          </h1>
          <p className="text-muted text-lg mb-10 max-w-sm mx-auto">
            This page doesn&apos;t exist, or was moved.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button href="/" variant="primary">Back to home</Button>
            <Button href="/docs" variant="outline">View docs</Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
