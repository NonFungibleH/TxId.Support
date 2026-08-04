/**
 * Who may do what.
 *
 * Roles are expressed as CAPABILITIES rather than checked by name at each call
 * site. `role === "admin" || role === "developer"` scattered through sixty
 * server actions is a rule nobody can read and everybody gets slightly wrong;
 * `requireCapability("settings")` states the intent and keeps the matrix in one
 * place, where it can be reviewed as a whole.
 *
 * ENFORCED SERVER-SIDE, ALWAYS. Hiding a button is presentation. The action
 * itself has to refuse, because a server action is a public HTTP endpoint that
 * anyone signed in can call directly.
 */

export const ROLES = ["admin", "developer", "support", "auditor"] as const
export type Role = (typeof ROLES)[number]

/**
 * The default for a member with no row.
 *
 * ADMIN, deliberately: roles are being introduced to organisations whose
 * members already have full access, and silently demoting them on deploy would
 * break working teams and generate support tickets against a compliance
 * feature. Teams downgrade people on purpose, not by our default.
 */
export const DEFAULT_ROLE: Role = "admin"

export type Capability =
  /** Change project configuration: contracts, branding, docs, integrations, embed. */
  | "settings"
  /** See and rotate API keys. */
  | "keys"
  /** Billing, plan and invoices. */
  | "billing"
  /** Invite, remove and re-role team members. */
  | "team"
  /** Delete a project, clear the knowledge base, erase records. */
  | "destroy"
  /** Work tickets and escalations. */
  | "tickets"
  /** Read conversations, case records, exports, analytics, change history. */
  | "records"

const MATRIX: Record<Role, Capability[]> = {
  // Everything, including the things that cost money or lose data.
  admin: ["settings", "keys", "billing", "team", "destroy", "tickets", "records"],
  // Builds and maintains the integration. No billing, no team, cannot delete.
  developer: ["settings", "keys", "tickets", "records"],
  // Answers users. Can act on tickets, cannot change how the bot behaves.
  support: ["tickets", "records"],
  // Reads and exports the evidence, changes nothing at all. The role you can
  // hand an external auditor or a compliance officer without hesitating.
  auditor: ["records"],
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  developer: "Developer",
  support: "Support",
  auditor: "Auditor",
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: "Everything, including billing, team and deletion.",
  developer: "Set up and maintain the assistant. No billing, team or deletion.",
  support: "Work tickets and escalations. Cannot change any configuration.",
  auditor: "Read and export records only. Cannot change anything.",
}

export function roleCan(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability)
}

export function capabilitiesOf(role: Role): Capability[] {
  return MATRIX[role]
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v)
}
