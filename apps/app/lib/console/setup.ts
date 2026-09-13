/**
 * Console readiness.
 *
 * The support product tells a customer where they are: what is configured, what
 * is left, and whether they are live. Without that a console is just screens,
 * and a new customer has no idea whether an empty queue means "all good" or
 * "you never finished setting up". That ambiguity is the difference between a
 * product and a set of pages.
 *
 * Steps are ORDERED BY DEPENDENCY, not importance. Nothing downstream of
 * customer identity works without it, which is why it cannot be skipped.
 */
export type StepId = "contracts" | "identity" | "crm" | "verify"

export interface SetupStep {
  id: StepId
  label: string
  href: string
  /** What the customer gets from finishing it, not what the system stores. */
  why: string
  done: boolean
  /** A step that is genuinely optional says so, rather than nagging forever. */
  optional?: boolean
}

export interface SetupState {
  steps: SetupStep[]
  complete: boolean
  /** The next thing to do, or null when there is nothing left. */
  next: SetupStep | null
  requiredRemaining: number
}

export interface ConsoleSetup {
  contracts: number
  identitySource: "none" | "pushed" | "crm_field" | "manual"
  crm: "none" | "intercom" | "zendesk" | "hubspot" | "freshdesk"
  verifiedLookupAt: string | null
}

/** Nothing configured: what a brand new workspace looks like. */
export const EMPTY_SETUP: ConsoleSetup = {
  contracts: 0,
  identitySource: "none",
  crm: "none",
  verifiedLookupAt: null,
}

/**
 * A workspace part-way through, used by the review copy.
 *
 * Deliberately INCOMPLETE: contracts added, but customers not yet joined to
 * wallets. That is both the most common place to stall and the step everything
 * else depends on, so it is the state worth showing.
 */
export const DEMO_SETUP: ConsoleSetup = {
  contracts: 3,
  identitySource: "none",
  crm: "none",
  verifiedLookupAt: null,
}

export function setupState(s: ConsoleSetup, base = "/console"): SetupState {
  const steps: SetupStep[] = [
    {
      id: "contracts",
      label: "Add your contracts",
      href: `${base}/settings/contracts`,
      why: "So the Console shows a customer's activity with you, and nothing else they do on-chain.",
      done: s.contracts > 0,
    },
    {
      id: "identity",
      label: "Connect customers to wallets",
      href: `${base}/settings/identity`,
      why: "Your agents have an email address, never a transaction hash. This is what lets them search for a person.",
      done: s.identitySource !== "none",
    },
    {
      id: "crm",
      label: "Connect your CRM",
      href: `${base}/settings/crm`,
      why: "Answers are written back onto the ticket your team already has open, so nobody keeps a second queue.",
      done: s.crm !== "none",
      optional: true,
    },
    {
      id: "verify",
      label: "Check it works",
      href: `${base}/settings/verify`,
      why: "Look up one real customer and confirm the answer is right before your team depends on it.",
      done: Boolean(s.verifiedLookupAt),
    },
  ]
  const required = steps.filter(x => !x.optional)
  const next = steps.find(x => !x.done && !x.optional) ?? steps.find(x => !x.done) ?? null
  return {
    steps,
    complete: required.every(x => x.done),
    next,
    requiredRemaining: required.filter(x => !x.done).length,
  }
}
