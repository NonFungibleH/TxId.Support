// Shared between the Telegram setup UI and the saveTelegramToken server action
// so the suggested name always matches what auto-configuration actually sets.

export function telegramBotName(projectName: string): string {
  const trimmed = projectName.trim()
  const name = /support$/i.test(trimmed) ? trimmed : `${trimmed} Support`
  return name.slice(0, 64)
}

// Telegram usernames: 5-32 chars, a-z / 0-9 / underscore, must end in "bot"
export function telegramBotUsernameSuggestion(projectName: string): string {
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/support$/, "")
  return `${base}support_bot`.slice(0, 32)
}

// BotFather tokens look like 7654321098:AAEhBG... (bot ID, colon, secret)
export const TELEGRAM_TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/
