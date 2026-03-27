import { Sidebar } from "@/components/Sidebar"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-56 flex-1">
        <div className="mx-auto max-w-3xl px-8 py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
