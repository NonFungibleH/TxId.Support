# Telegram Integration — Design Spec
**Date:** 2026-07-01
**Status:** Approved for implementation

---

## Overview

Add Telegram as a second support channel alongside the web widget. Protocol teams add the shared `@TxIDBot` to their Telegram community group. The bot is context-aware for their specific project — it knows their smart contracts, docs, and error glossary — and can diagnose failed transactions from a wallet address or tx hash. Access is gated to Pro and above, enforced on every message.

---

## Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Bot model | Shared platform bot (`@TxIDBot`) | Zero token management for teams |
| Scope | Group chats only (no DMs in v1) | Main DeFi community use case |
| Tx diagnosis | Wallet address first, tx hash accepted too | Most users know address; few know hash |
| Plan gating | Pro, Enterprise, Custom (`plan !== "free"`) | Includes legacy starter |
| Plan enforcement | Check on every message | Handles downgrades, re-invites, cancellations |
| Groups per project | One group per project in v1 | Prevents key-sharing abuse (see Security) |
| Plan downgrade | Leave `telegram_groups` row in place | Bot gates per-message; seamless re-activation on re-subscribe |

---

## Architecture

### Request flow

```
Telegram group message
  → POST /api/telegram/webhook
    → verify X-Telegram-Bot-Api-Secret-Token header === TELEGRAM_WEBHOOK_SECRET (constant-time)
    → return 401 if mismatch
    → if my_chat_member event with status kicked/left → delete telegram_groups row → return 200
    → if /connect command → connectFlow() → return 200
    → if /disconnect command → disconnectFlow() → return 200
    → if not @mention or reply-to-bot → return 200 (ignore)
    → look up chat_id in telegram_groups → project_id (if missing → return 200, ignore)
    → load project: SELECT id, config FROM projects WHERE id = project_id
    → update chat_title from message.chat.title (upsert telegram_groups)
    → check config->>'plan' — if "free" or null → send lapsed message → return 200
    → build systemPrompt(config, channel: "telegram")
    → load last 10 messages from conversations table (session_id = chat_id)
    → call streamChatWithTools(systemPrompt, messages, null, watchedContractsFromConfig, 600)
      (5th arg maxTokens is already supported in the existing function signature)
    → collect full response (non-streaming — await the generator to completion)
    → escapeMarkdownV2(response), trim to 4000 chars if needed
    → await sendTelegramMessage(chatId, response, "MarkdownV2")
      → if Telegram returns 400 (parse error): await sendTelegramMessage(chatId, plainResponse)
      → if Telegram returns 429: wait 1s, retry once
    → upsert conversation row (session_id=chat_id, project_id) + insert message rows
      (inbound user message + bot reply, same schema as web widget)
    → return 200
```

**Telegram's 5s webhook timeout:** `streamChatWithTools` typically completes in 1–3s at `maxTokens: 600`. The await-then-reply pattern is fine. We do not use fire-and-forget — awaiting the send is required to observe 400/429 and handle the fallback/retry.

### Webhook registration (one-time, done by TxID team at deploy)

Run `scripts/register-telegram-webhook.sh` after setting env vars in Vercel. It is safe to re-run (Telegram's `setWebhook` is idempotent). **Re-run whenever `TELEGRAM_WEBHOOK_SECRET` is rotated** — the new secret must be registered or Telegram will send the old secret and all requests will return 401.

```bash
#!/usr/bin/env bash
# scripts/register-telegram-webhook.sh
# Safe to re-run. Re-run if TELEGRAM_WEBHOOK_SECRET is rotated.
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${APP_URL}/api/telegram/webhook\", \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"}"
```

### Webhook verification

Telegram sends `X-Telegram-Bot-Api-Secret-Token` on every request. Compare to `TELEGRAM_WEBHOOK_SECRET` using `timingSafeEqual` from Node's `crypto` module. Return 401 if mismatch.

### Bot response trigger

The bot only processes messages that are:
- A direct `@mention` of the bot (`message.entities` contains type `"mention"` with text matching the bot username), OR
- A reply to one of the bot's own messages (`message.reply_to_message?.from?.is_bot === true && message.reply_to_message?.from?.username === BOT_USERNAME`)

All other group messages: return 200 immediately (ignore).

---

## Database

### New migration: `20260701000002_telegram_groups.sql`

```sql
create table telegram_groups (
  id           uuid primary key default gen_random_uuid(),
  chat_id      text not null unique,
  project_id   uuid not null references projects(id) on delete cascade,
  chat_title   text not null default '',
  connected_at timestamptz not null default now()
);

create index telegram_groups_project_id_idx on telegram_groups(project_id);
create unique index telegram_groups_project_unique_idx on telegram_groups(project_id);
-- one group per project enforced at DB level
```

`on delete cascade` — deleting a project cleans up its telegram connection automatically.

`chat_title default ''` — not nullable, avoids null-handling in dashboard display. Updated from `message.chat.title` on every chat message.

---

## Setup flow

Goal: connected in under 30 seconds, no developer knowledge required.

### Dashboard instructions (shown in TelegramConnect card)

**Step 1.** Open Telegram and add `@TxIDBot` to your group as an admin.
**Step 2.** Copy your connect command (one-click copy button):
```
/connect txid_pub_XXXXX
```
**Step 3.** Paste it in your Telegram group. The bot will confirm it's live.

### `/connect` command handler

Received by the webhook when a group message text starts with `/connect `.

```
parse key from message text after "/connect "
look up project by publishable_key in projects table
if not found → reply: "That key wasn't recognised. Copy your connect command from app.txid.support."
  → return

check telegram_groups for existing row WHERE project_id = found project's id:
  case: row exists AND chat_id === current chat_id
    → upsert { chat_title: message.chat.title }
    → reply confirmation (idempotent success)
    → return
  case: row exists AND chat_id !== current chat_id
    → reply: "This project is already connected to another group. Disconnect it first from app.txid.support."
    → return

check config->>'plan' — if "free" or null:
  → reply: "Telegram is available on Pro and above. Upgrade at app.txid.support."
  → return

insert telegram_groups: { chat_id, project_id, chat_title: message.chat.title }
reply: "Connected! I'm now the support assistant for **[Project Name]**. Mention me or reply to my messages and I'll help your community."
```

**Note on order:** existing-connection check runs BEFORE plan check. This ensures that if a project downgrades and then tries to re-run `/connect` from their already-connected group, it succeeds idempotently rather than showing an upgrade message.

The publishable key is intentionally public (already in teams' website JS snippet). The one-group-per-project constraint is the abuse mitigation — a second group cannot connect while the first is active.

### `/disconnect` command handler

```
look up chat_id in telegram_groups
if not found → reply: "This group isn't connected."
call getChatMember(chatId, senderId) — if not admin/creator → reply: "Only group admins can disconnect the bot." → return
delete telegram_groups row WHERE chat_id = chat_id
reply: "Disconnected. Run /connect YOUR_KEY to reconnect."
```

### Bot removed from group

When Telegram fires a `my_chat_member` update with `new_chat_member.status` of `"kicked"` or `"left"`:
- Delete the `telegram_groups` row for this `chat_id`
- No reply (bot can't send to a group it's been removed from)
- Return 200

### Dashboard Disconnect button

Calls `disconnectGroup(projectId)` server action. Auth via `resolveProjectWithOwnership` (Clerk-authenticated project owner) — no Telegram admin check needed from the dashboard, as ownership is already verified at the Clerk/org level.

---

## Plan gating

### Dashboard (UX gate)

Free-plan projects: `TelegramConnect` card renders an upgrade prompt instead of the connect UI.

Paid plans: full connect UI with step-by-step instructions.

### Bot enforcement (every incoming chat message, and on `/connect`)

```typescript
const plan = project.config?.plan
const hasAccess = plan && plan !== "free"
if (!hasAccess) {
  await sendTelegramMessage(chatId,
    "This group's TxID Support subscription has lapsed. The team can reactivate at app.txid.support.")
  return
}
```

---

## Chat experience

### Wallet and transaction tools on Telegram

`walletConfig` is always `null` on Telegram. The AI still has access to wallet tools (`get_recent_transactions`, `get_transaction_by_hash`) — they accept an address as a tool input parameter. The `watchedContracts` are loaded from `project.config.watchedContracts` and passed to `streamChatWithTools` as normal.

The Telegram system prompt variant (when `channel === "telegram"`) replaces the wallet section with:

> When a user says a transaction failed or asks about a transaction, ask for their wallet address: "Share your wallet address and I'll look it up for you." Once you have it, call `get_recent_transactions` to find the most recent failed transaction and diagnose it. If the user shares a transaction hash directly, call `get_transaction_by_hash` instead. Never ask for both — use whichever the user provides first.

### Conversation persistence

`session_id` = `chat_id` (Telegram group's numeric ID as a string, prefixed `"tg_"` to avoid collision with web session IDs).

On each chat message:
1. **Load:** `SELECT * FROM messages WHERE conversation.session_id = session_id ORDER BY created_at DESC LIMIT 10`
2. **After AI responds:** upsert conversation row, insert two message rows (user inbound + bot reply) — same schema as web widget messages.

### `streamChatWithTools` call

```typescript
streamChatWithTools(
  systemPrompt,   // Telegram variant
  messages,       // last 10 from DB
  null,           // walletConfig — always null on Telegram
  watchedContracts,
  600,            // maxTokens — 5th positional arg, already in existing signature
)
```

### Message formatting

`escapeMarkdownV2(text: string): string` — written inline in the webhook route, no library. Escapes all MarkdownV2 special chars: `_ * [ ] ( ) ~ > # + - = | { } . !`. Bold `**text**` → `*text*` before escaping content. Inline code unchanged.

`sendMessage` is called with `parse_mode: "MarkdownV2"`. If Telegram returns 400 (parse error), retry immediately with `parse_mode` omitted (plain text fallback). If Telegram returns 429, wait 1 second then retry once.

### Message length

If response exceeds 4000 chars, trim at the last sentence-ending character (`.`, `!`, `?`) before the 4000-char mark. Append:
```
_(response trimmed — visit docs.txid.support for more)_
```
No message splitting in v1. `maxTokens: 600` makes this rare in practice.

---

## New files

### `apps/app/app/api/telegram/webhook/route.ts`

```typescript
export async function POST(req: Request): Promise<Response> {
  // 1. Verify X-Telegram-Bot-Api-Secret-Token (timingSafeEqual), return 401 if wrong
  // 2. Parse Telegram Update object
  // 3. Route by update type:
  //    my_chat_member kicked/left → deleteGroup(chat_id) → return 200
  //    message starting with "/connect " → connectFlow() → return 200
  //    message starting with "/disconnect" → disconnectFlow() → return 200
  //    message with @mention or reply-to-bot → chatFlow() → return 200
  //    anything else → return 200
}

// Internal helpers (not exported):
async function connectFlow(update: TelegramUpdate): Promise<void>
async function disconnectFlow(update: TelegramUpdate): Promise<void>
async function chatFlow(update: TelegramUpdate): Promise<void>
function escapeMarkdownV2(text: string): string
async function sendTelegramMessage(chatId: string, text: string, parseMode?: "MarkdownV2"): Promise<void>
```

### `apps/app/lib/actions/telegram.ts`

```typescript
export async function getTelegramConnection(projectId: string): Promise<{
  chatId: string
  chatTitle: string
  connectedAt: string
} | null>
// Uses resolveProjectWithOwnership. Returns null if no row in telegram_groups.

export async function disconnectGroup(projectId: string): Promise<void>
// Uses resolveProjectWithOwnership. Deletes telegram_groups row for this project_id.
```

`connectGroup` is not a server action — connection happens via the `/connect` Telegram command, not from the dashboard.

### `apps/app/components/settings/TelegramConnect.tsx`

```typescript
interface Props {
  projectId: string
  plan: Plan
  connection: { chatId: string; chatTitle: string; connectedAt: string } | null
  publishableKey: string
}
```

Three render states:
1. **Free plan** (`plan === "free"`): amber upgrade card — "Telegram is available on Pro. [Upgrade →]"
2. **Paid, not connected** (`connection === null`): numbered step instructions + one-click copy button for `/connect {publishableKey}` + link to open `@TxIDBot` on Telegram
3. **Paid, connected**: green badge "Connected to {chatTitle}", connected-since date, Disconnect button (calls `disconnectGroup`, `useTransition` + toast)

### `supabase/migrations/20260701000002_telegram_groups.sql`

As defined in the Database section above.

### `scripts/register-telegram-webhook.sh`

As defined in the Webhook registration section above.

---

## Modified files

### `packages/ai/src/types.ts`

```typescript
// Add to StreamChatParams:
channel?: "web" | "telegram"
// Optional. Omitting it = "web" behaviour (no change to existing callers).
```

### `packages/ai/src/prompt.ts`

`buildSystemPrompt` receives `channel` from `StreamChatParams`. When `channel === "telegram"`, the wallet section is replaced with the Telegram address-request instructions. All other sections are unchanged.

### `.env.example`

```
TELEGRAM_BOT_TOKEN=        # from @BotFather — platform-level, not per-project
TELEGRAM_WEBHOOK_SECRET=   # random string; re-register webhook if this rotates
```

---

## Error handling summary

| Scenario | Handling |
|---|---|
| Invalid `X-Telegram-Bot-Api-Secret-Token` | Return 401 |
| `chat_id` not in `telegram_groups` | Return 200, no reply |
| `/connect` with invalid publishable key | Reply with helpful error |
| `/connect` idempotent (same chat, same project) | Upsert chat_title, reply confirmation |
| `/connect` when project already connected to a different group | Reply with disconnect-first message |
| `/connect` on free plan (checked AFTER existing-connection check) | Reply with upgrade message |
| `/disconnect` from non-admin | Reply: "Only group admins can disconnect the bot." |
| Bot removed from group | Delete row, return 200 |
| Plan lapsed (per-message check) | Reply with lapsed message, return |
| AI call fails | Reply: "Something went wrong — try again in a moment." |
| `sendMessage` 400 (MarkdownV2 parse error) | Retry immediately as plain text |
| `sendMessage` 429 (rate limit) | Wait 1s, retry once |
| `chat_title` staleness | Updated from `message.chat.title` on every chat message |
| `TELEGRAM_WEBHOOK_SECRET` rotation | Re-run `scripts/register-telegram-webhook.sh` |

---

## Out of scope (v1)

- 1-to-1 DM support
- Multiple groups per project
- Inline keyboards or button responses
- Per-channel analytics breakdown (session_id prefixed `"tg_"` enables this later)
- Discord or other channels
