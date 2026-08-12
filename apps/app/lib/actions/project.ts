"use server"

import { waitUntil } from "@vercel/functions"
import { requireCapability } from "@/lib/roles-server"
import { isCurrentUserAdmin } from "@/lib/admin-auth"

import { resolveOrg } from "@/lib/clerk-org"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import { DEFAULT_CONFIG } from "@/lib/types/config"
import { revalidatePath } from "next/cache"
import { recordAudit, diffConfig } from "@/lib/audit"
import { refuse, type ActionResult } from "@/lib/actions/result"
import { stripServerOwnedKeys } from "@/lib/config-guard"
import type { Database, Json } from "@/lib/supabase/types"

type OrgRow = Database["public"]["Tables"]["organisations"]["Row"]

export async function getProject() {
  const { orgId, userId, orgSlug } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  // SELECT BEFORE INSERT, and NEVER write `name` on an existing row.
  // This was an upsert of { clerk_org_id, name: "My Protocol" }, which runs on
  // every page load, so onConflict rewrote the name back to "My Protocol"
  // every time. No organisation could ever be renamed: any change survived
  // until the next request. That is why every account header read "My
  // Protocol" regardless of what the company was called.
  const existing = await supabase
    .from("organisations")
    .select()
    .eq("clerk_org_id", orgKey)
    .maybeSingle()

  let org = existing.data as unknown as OrgRow | null

  if (!org) {
    // Only on FIRST sight. Clerk's slug is a far better starting name than a
    // placeholder, and it is already in the session so it costs no API call.
    const created = await supabase
      .from("organisations")
      .insert({ clerk_org_id: orgKey, name: orgSlug ?? "My Protocol" })
      .select()
      .single()
    if (created.error || !created.data) {
      throw new Error(`Org create failed: ${created.error?.message}`)
    }
    org = created.data as unknown as OrgRow
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at")
    .limit(1)
    .maybeSingle()

  return { org, project: project ?? null }
}

// Project creation is invite-only during the private beta. Sign-ups are open so
// invited teammates can accept, but a fresh stranger's session has no org row so
// currentActor() returns DEFAULT_ROLE = admin, and requireCapability("settings")
// alone would let them create their own project via this action and slip past
// the hand-onboarding gate (the /onboarding holding screen is UI-only).
// Restrict creation to platform operators (ADMIN_EMAILS). Revisit when public
// self-serve sign-up is turned back on.
async function requireProjectCreator(): Promise<void> {
  if (!(await isCurrentUserAdmin())) {
    throw new Error("Project creation is invite-only right now. Contact team@txid.support to get set up.")
  }
}

export async function createProject(name: string) {
  await requireCapability("settings")
  await requireProjectCreator()
  const { orgId, userId } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const upsertOrgResult2 = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgKey, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  const org = upsertOrgResult2.data as unknown as OrgRow | null
  if (!org) throw new Error("Could not resolve organisation")

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name,
      config: DEFAULT_CONFIG as unknown as Json,
    })
    .select()
    .single()

  if (error || !project) throw new Error(`Create project failed: ${error?.message}`)

  revalidatePath("/dashboard")
  return project
}

export async function createProjectWithMode(name: string, mode: "support" | "token") {
  await requireCapability("settings")
  await requireProjectCreator()
  const { orgId, userId } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const upsertOrgResult = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgKey, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  const org = upsertOrgResult.data as unknown as OrgRow | null
  if (!org) throw new Error("Could not resolve organisation")

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name,
      mode,
      is_active: false,
      config: DEFAULT_CONFIG as unknown as Json,
    })
    .select()
    .single()

  if (error || !project) throw new Error(`Create project failed: ${error?.message}`)

  revalidatePath("/dashboard")
  return project
}

export async function renameOrg(name: string): Promise<ActionResult> {
  await requireCapability("settings")
  const { orgId, userId } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) return refuse("Give it a name between 1 and 80 characters.")

  const supabase = createServiceClient()

  const { error } = await supabase
    .from("organisations")
    .update({ name: trimmed })
    .eq("clerk_org_id", orgKey)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/account")

  return { ok: true }
}

export async function renameProject(projectId: string, name: string): Promise<ActionResult> {
  await requireCapability("settings")
  const { orgId, userId } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) return refuse("Give it a name between 1 and 80 characters.")

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org) throw new Error("Org not found")

  const { error } = await supabase
    .from("projects")
    .update({ name: trimmed })
    .eq("id", projectId)
    .eq("org_id", org.id)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")

  return { ok: true }
}

export async function updateConfig(
  projectId: string,
  partial: Partial<ProjectConfig>
) {
  await requireCapability("settings")
  const { orgId, userId } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const { data: current, error: fetchError } = await supabase
    .from("projects")
    .select("config, org_id")
    .eq("id", projectId)
    .single()

  if (fetchError || !current) throw new Error("Project not found")

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org || current.org_id !== org.id) {
    throw new Error(
      `Forbidden [updateConfig]: project ${projectId} belongs to org ${current.org_id ?? "null"}, ` +
      `but you are in ${org?.id ?? "no org row"} (clerk ${orgKey}). ` +
      `This usually means the page was loaded under a different company.`,
    )
  }

  // Validate webhookUrl before persisting - must be HTTPS + public IP
  if (partial.webhookUrl) {
    const { assertSafeWebhookUrl } = await import("@/lib/security")
    assertSafeWebhookUrl(partial.webhookUrl)
  }

  // When a token is being saved, resolve its symbol + name from on-chain so the
  // widget shows e.g. "PHAR" instead of "Unknown". Best-effort - never blocks
  // the save if the lookup fails.
  let resolvedPartial = partial
  if (partial.token && partial.token.address) {
    try {
      const { getTokenInfo } = await import("@txid/blockchain")
      const info = await getTokenInfo(partial.token.address, partial.token.chain as string)
      if (info && (info.symbol || info.name)) {
        resolvedPartial = {
          ...partial,
          token: {
            ...partial.token,
            symbol: info.symbol ?? partial.token.symbol ?? null,
            name: info.name ?? partial.token.name ?? null,
          },
        }
      }
    } catch { /* keep whatever was provided */ }
  }

  // Strip server-owned keys before merge. SECURITY BOUNDARY, not tidy-up: see
  // stripServerOwnedKeys.
  const safePartial = stripServerOwnedKeys(resolvedPartial)

  const merged = {
    ...(current.config as unknown as ProjectConfig),
    ...safePartial,
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ config: merged as unknown as Json })
    .eq("id", projectId)
    .eq("org_id", org.id)

  if (updateError) throw new Error(`Update failed: ${updateError.message}`)

  // One hook covers every configuration change, because every one of them
  // funnels through here: branding, integrations, contracts, chains, actions,
  // sub accounts.
  //
  // WHAT CHANGED, not merely WHICH KEY. This used to record the key names
  // alone, so the history read "docsSync, docsSync" and could not tell an
  // auditor whether the switch had been turned on or off, or what it was
  // before. Values of credential-shaped keys are still never recorded: a
  // secret's presence is auditable, its content is not, and that is what makes
  // this table safe to show a reviewer.
  //
  // A save that moved nothing is not recorded at all. Debounced forms re-save
  // the same object on every keystroke, which is why four identical rows
  // appeared seconds apart and buried the changes that were real.
  const changes = diffConfig(
    (current.config ?? {}) as Record<string, unknown>,
    safePartial as Record<string, unknown>,
  )
  if (changes.length > 0) {
    waitUntil(recordAudit({
      action: "config.updated",
      target: changes.map(c => c.field).join(", "),
      projectId,
      orgId: org.id,
      metadata: { fields: changes.map(c => c.field), changes },
    }))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/branding")
  revalidatePath("/dashboard/token")
  revalidatePath("/dashboard/contracts")
  revalidatePath("/dashboard/docs")
  revalidatePath("/dashboard/chains")
  revalidatePath("/dashboard/content")
  revalidatePath("/dashboard/community")
  revalidatePath("/dashboard/ask")
}

export async function confirmPreview(projectId: string) {
  await requireCapability("settings")
  const { orgId, userId } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org) throw new Error("Org not found")

  const { data: project } = await supabase
    .from("projects")
    .select("config")
    .eq("id", projectId)
    .eq("org_id", org.id)
    .single()

  if (!project) throw new Error("Project not found")

  const config = project.config as unknown as import("@/lib/types/config").ProjectConfig
  const updated = { ...config, previewConfirmed: true }

  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as import("@/lib/supabase/types").Json })
    .eq("id", projectId)
    .eq("org_id", org.id)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/preview")
}

/**
 * What a server action says when the user did something we expected them to do
 * wrong. RETURNED, never thrown.
 *
 * WHY: Next.js redacts a thrown Error in production and hands the client a
 * generic 500, so "Add the domain your widget will be installed on" reached the
 * user as an unexplained failure and a red line in the console. The message was
 * carefully written and structurally unable to arrive. Anything the user can
 * fix must come back as a value.
 *
 * Throwing is still right for the unexpected: not signed in, no organisation,
 * a database that refused. Those are ours to fix, not theirs to read.
 */
export interface ActionRefusal {
  ok: false
  /** Plain sentence naming the cause, shown to the user verbatim. */
  reason: string
  /** Where to go and fix it, when there is such a place. */
  fix?: { label: string; href: string }
}

export async function toggleActive(
  projectId: string,
  isActive: boolean,
): Promise<{ ok: true } | ActionRefusal> {
  await requireCapability("settings")
  const { orgId, userId } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org) throw new Error("Org not found")

  // GOING LIVE REQUIRES A DOMAIN. The publishable key becomes public the
  // moment a widget ships, so this is the exact point at which an unrestricted
  // key stops being theoretical: anyone who views source can copy it and spend
  // the customer's quota from their own site. Enforced SERVER-SIDE, not just
  // in the form, because the form is not the security boundary.
  //
  // NOT retroactive: an already-live project keeps serving, because taking a
  // customer's widget down to enforce a new rule would be worse than the risk.
  // And not applicable to public surfaces, which exist to be embedded anywhere.
  if (isActive) {
    const { data: proj } = await supabase
      .from("projects")
      .select("config")
      .eq("id", projectId)
      .eq("org_id", org.id)
      .single()
    const cfg = (proj as unknown as { config?: ProjectConfig } | null)?.config
    const domains = cfg?.allowedDomains ?? []
    const openByChoice = cfg?.allowUnrestrictedKey === true
    if (domains.length === 0 && cfg?.publicDemo !== true && !openByChoice) {
      return {
        ok: false,
        reason:
          "Your widget is not restricted to a domain yet. Because your publishable key is " +
          "visible in your page source, going live without one means anyone who copies it " +
          "can run the assistant from their own site, at your cost.",
        fix: { label: "Add your domain", href: "/dashboard/embed" },
      }
    }
  }

  const { error } = await supabase
    .from("projects")
    .update({ is_active: isActive })
    .eq("id", projectId)
    .eq("org_id", org.id)

  if (error) throw new Error(error.message)

  // Going live and going dark are the two changes a customer most often needs
  // to date afterwards, and neither is visible in the config diff above.
  waitUntil(recordAudit({
    action: isActive ? "widget.enabled" : "widget.disabled",
    projectId,
    orgId: org.id,
  }))

  revalidatePath("/dashboard")

  return { ok: true }
}
