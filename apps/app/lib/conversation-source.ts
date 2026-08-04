/**
 * Which surface a conversation came in on.
 *
 * Derived from the session id rather than stored, so it works retroactively on
 * every conversation already in the database. The prefixes are set at the
 * point of creation: `tg-{chatId}-{userId}` by the Telegram webhook and
 * `preview-…` by the dashboard preview; anything else is the embedded widget.
 *
 * WHY IT MATTERS: a Telegram conversation and a widget conversation are the
 * same shape in the table and completely different in what they mean. Telegram
 * has no wallet and no on-chain tools, so judging its answers by the same
 * standard as the widget's is comparing two different products.
 */

export type ConversationSource = "widget" | "telegram" | "preview"

export const SOURCE_LABEL: Record<ConversationSource, string> = {
  widget: "Widget",
  telegram: "Telegram",
  preview: "Preview",
}

export function sourceOf(sessionId: string | null | undefined): ConversationSource {
  if (!sessionId) return "widget"
  if (sessionId.startsWith("tg-")) return "telegram"
  if (sessionId.startsWith("preview-")) return "preview"
  return "widget"
}
