/**
 * The one async entry point: a hash goes in, a Resolution comes out.
 *
 * This is the ONLY file in lib/resolution that touches the network, and it does
 * so by delegating to the gatherers that already exist and are already proven
 * (diagnoseTransaction for EVM, getAptosTransactionByHash for Aptos). Nothing
 * here re-implements fetching; it fans out, adapts, and hands the evidence to
 * the pure resolver.
 *
 * WHY THE FAN-OUT IS PARALLEL: an Aptos hash is 0x + 64 hex, format-identical
 * to an EVM hash, so the chain cannot be inferred from the string. The same
 * problem the chat tools solved, solved the same way.
 */

import { diagnoseTransaction } from "@txid/blockchain"
import { AptosLookupUnavailableError, getAptosTransactionByHash, errmapFor } from "@txid/aptos"
import { resolve } from "./resolve"
import { fromEvmDiagnosis, fromAptosTx, lookupFailed, notFound, type CallerContext } from "./adapt"
import type { Resolution } from "./types"

export interface ResolveByHashOptions extends CallerContext {
  /** Restrict the search to one chain. "aptos" or an EVM chain id. */
  chain?: string
  /** Watched contracts, so protocol error maps apply to Move aborts. */
  watchedContracts?: readonly { address: string; chain: string }[]
}

/**
 * Diagnose a transaction hash across supported chains and return a Resolution.
 *
 * Never throws: a lookup failure resolves to an honest INDETERMINATE answer
 * rather than an exception, because a support path that 500s is worse than one
 * that says "we could not determine this".
 */
export async function resolveByHash(hash: string, opts: ResolveByHashOptions = {}): Promise<Resolution> {
  const { chain, watchedContracts, ...ctx } = opts
  const wantsAptos = !chain || chain === "aptos"
  const wantsEvm = !chain || chain !== "aptos"

  const errmap = watchedContracts ? errmapFor(watchedContracts) : undefined

  const [evm, aptos] = await Promise.all([
    wantsEvm
      ? diagnoseTransaction(hash, chain && chain !== "aptos" ? chain : undefined).catch(() => null)
      : Promise.resolve(null),
    wantsAptos
      // `.catch(() => null)` sent an unreachable fullnode down the not_found
      // path, and not_found carries a custody claim an integrator draws a
      // button from. That is bug #72 in the Aptos arm.
      ? getAptosTransactionByHash(hash, errmap).catch((e: unknown) =>
          e instanceof AptosLookupUnavailableError ? ("unreachable" as const) : null,
        )
      : Promise.resolve(null),
  ])
  const aptosUnreachable = aptos === "unreachable"
  const aptosTx = aptosUnreachable ? null : aptos

  // Prefer whichever chain actually has the transaction. A found Aptos tx beats
  // an EVM "not_found", and vice versa; if both somehow hit, EVM wins only when
  // it genuinely mined the transaction.
  const evmFound = !!evm && evm.status !== "not_found"
  if (evmFound) return resolve(fromEvmDiagnosis(evm, hash, ctx))
  if (aptosTx) return resolve(fromAptosTx(aptosTx, hash, ctx))
  if (evm) return resolve(fromEvmDiagnosis(evm, hash, ctx))

  // Nobody could be asked. Custody is unknown, so the answer is indeterminate,
  // never "we looked and it is not there".
  if (aptosUnreachable) return resolve(lookupFailed(hash, ctx))

  return resolve(notFound(hash, ctx))
}
