/**
 * Minimal layout for the embeddable widget — no dashboard chrome, no sidebar.
 * The inline <style> forces a dark background in the server-rendered HTML so
 * the iframe never shows white before next-themes hydrates.
 */
export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html,body{background-color:#0a0a0f}`}</style>
      {children}
    </>
  )
}
