import type { LayerZeroMessage, LzExplanation } from "./types"

/**
 * Turn a LayerZero message into a verdict a person and a machine can both act
 * on.
 *
 * THE ONE THING THIS MUST GET RIGHT is `retryable`. A user whose funds have
 * left the source chain and not arrived is one click away from bridging a
 * second time, and unlike a failed swap that mistake is not free: the first
 * transfer is still in flight and will land. Every in-flight and every
 * unrecognised state therefore returns `retryable: "no"`. Waiting is not
 * retrying, and not knowing is never a licence to act.
 *
 * WHY THERE IS NO TABLE OF FAILURE STATUSES. Only three appear in live
 * traffic: SUCCEEDED, WAITING and VALIDATING_TX (100 recent messages,
 * 2026-09-07). LayerZero's stack can emit others, but we have not observed
 * them, and writing confident wording for a status we have never seen is how
 * this codebase has been wrong before. Anything unrecognised takes the
 * conservative path, which still protects the user because it still says do
 * not send it again.
 */

const arrived = (s: string) => s === "SUCCEEDED"
const settling = (s: string) => s === "WAITING" || s === "VALIDATING_TX"

/** Where the value is, in the words a person would use. */
function route(m: LayerZeroMessage): string {
  const from = m.source.chain ?? "the source chain"
  const to = m.destination.chain ?? "the destination chain"
  const via = m.app ? ` via ${m.app}` : ""
  return `from ${from} to ${to}${via}`
}

export function explainLayerZero(m: LayerZeroMessage): LzExplanation {
  const src = m.source.status
  const dst = m.destination.status
  const where = route(m)

  // The source transaction has not settled yet. Nothing has crossed, and the
  // send itself may still fail, so we cannot say the funds have moved.
  if (settling(src)) {
    return {
      status: "pending",
      custody: "unknown",
      retryable: "no",
      nextActionOwner: "infrastructure",
      headline: `This transfer ${where} is still being confirmed on the source chain, so it has not been sent across yet.`,
      recommendedAction: "Wait for the source transaction to confirm. Do not send it again: if it confirms, a second transfer would go across as well.",
      unrecognised: false,
    }
  }

  if (arrived(src) && arrived(dst)) {
    return {
      status: "succeeded",
      custody: "moved",
      retryable: "no",
      nextActionOwner: "none",
      headline: `This transfer ${where} completed. It arrived on ${m.destination.chain ?? "the destination chain"}.`,
      recommendedAction: "Nothing to do. If the balance still looks wrong, check the receiving address on the destination chain rather than the sending one.",
      unrecognised: false,
    }
  }

  // THE CASE THIS EXISTS FOR. The source succeeded and every other tool stops
  // there. The value has left and has not landed: neither where it was nor
  // where it is going, which is exactly what "partial" means.
  if (arrived(src) && settling(dst)) {
    return {
      status: "pending",
      custody: "partial",
      retryable: "no",
      nextActionOwner: "infrastructure",
      headline: `This transfer ${where} left ${m.source.chain ?? "the source chain"} successfully and has not arrived yet. It is in transit, not lost.`,
      recommendedAction: "Wait. Delivery is handled by the bridge, not by you, and there is nothing to sign. Do not send it again: the first transfer is still on its way and a second one would also go through.",
      unrecognised: false,
    }
  }

  // Source succeeded, destination reports something we have not seen.
  if (arrived(src)) {
    return {
      status: "indeterminate",
      custody: "partial",
      retryable: "no",
      nextActionOwner: "unknown",
      headline: `This transfer ${where} left ${m.source.chain ?? "the source chain"} successfully. The bridge reports its delivery as "${dst}", which we cannot interpret, so we will not tell you what it means.`,
      recommendedAction: `Do not send it again while the outcome is unknown. Give the bridge operator the message id${m.guid ? ` ${m.guid}` : ""} and the source transaction, which is everything they need to trace it.`,
      unrecognised: true,
    }
  }

  return {
    status: "indeterminate",
    custody: "unknown",
    retryable: "no",
    nextActionOwner: "unknown",
    headline: `The bridge reports this transfer ${where} as "${src}", which we cannot interpret, so we will not tell you what it means.`,
    recommendedAction: `Do not send it again while the outcome is unknown. Give the bridge operator the message id${m.guid ? ` ${m.guid}` : ""} and the source transaction.`,
    unrecognised: true,
  }
}
