/**
 * Minimal layout for the embeddable widget — no dashboard chrome, no sidebar.
 * The root layout's ClerkProvider still wraps this, which is fine.
 */
export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
