import { decodeAbort } from "../src/abort"
import {
  aptosGet,
  getAccount,
  getAptosModuleAbi,
  getAptosNetworkStatus,
  getAptosTransactionByHash,
  getLedgerInfo,
} from "../src/fullnode"
import { diagnoseAptosWallet, getAptosRecentTransactions, getAptosWalletBalance } from "../src/indexer"

let failed = false

function report(name: string, ok: boolean, detail: string): void {
  const status = ok ? "PASS" : "FAIL"
  console.log(`${status}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failed = true
}

function skip(name: string, detail: string): void {
  console.log(`SKIP  ${name} — ${detail}`)
}

function pause(ms = 400): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function indexerRateLimited(): Promise<boolean> {
  try {
    const res = await fetch("https://api.mainnet.aptoslabs.com/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { ledger_infos(limit: 1) { chain_id } }" }),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 429) return true
    const json = (await res.json()) as { errors?: unknown[] }
    return !!json.errors && JSON.stringify(json.errors).includes('"429"')
  } catch {
    return false
  }
}

interface RawTx {
  type: string
  hash?: string
  version?: string
  success?: boolean
  vm_status?: string
  sender?: string
}

async function main(): Promise<void> {
  const ledger = await getLedgerInfo()
  {
    const ok =
      ledger !== null &&
      ledger.chainId === 1 &&
      /^\d+$/.test(ledger.ledgerVersion) &&
      Math.abs(Date.now() - Number(ledger.ledgerTimestamp) / 1000) < 5 * 60_000
    report(
      "getLedgerInfo",
      ok,
      ledger ? `chainId=${ledger.chainId} version=${ledger.ledgerVersion}` : "no response"
    )
  }

  await pause()
  {
    const abi = await getAptosModuleAbi("0x1", "coin")
    const transfer = abi?.functions.find(f => f.name === "transfer")
    const ok =
      !!transfer &&
      transfer.isEntry &&
      !transfer.params.some(p => p === "signer" || p === "&signer")
    report(
      "getAptosModuleAbi(0x1, coin)",
      ok,
      transfer ? `transfer params=[${transfer.params.join(", ")}]` : "transfer not found"
    )
  }

  await pause()
  const sampleSenders: string[] = []
  {
    const recent = await aptosGet<RawTx[]>("/transactions?limit=20")
    for (const t of recent ?? []) {
      if (t.type === "user_transaction" && t.success === true && t.sender && !sampleSenders.includes(t.sender)) {
        sampleSenders.push(t.sender)
      }
    }
    const userTx = (recent ?? []).find(t => t.type === "user_transaction" && t.success === true && t.hash)
    if (!userTx?.hash) {
      report("tx by hash (success)", false, "no recent user_transaction found to test with")
    } else {
      const byHash = await getAptosTransactionByHash(userTx.hash)
      const byVersion = byHash ? await getAptosTransactionByHash(byHash.version) : null
      const ok =
        byHash !== null &&
        byHash.success === true &&
        byHash.hash === userTx.hash &&
        byHash.version === userTx.version &&
        byVersion !== null &&
        byVersion.hash === byHash.hash &&
        byHash.decodedAbort === undefined
      report(
        "tx by hash (success)",
        ok,
        byHash
          ? `hash=${byHash.hash.slice(0, 14)}… version=${byHash.version} functionId=${byHash.functionId ?? "null"}`
          : "fetch by hash returned null"
      )
    }
  }

  await pause()
  {
    let found: RawTx | null = null
    const latest = ledger ? Number(ledger.ledgerVersion) : null
    if (latest) {
      for (let page = 1; page <= 3 && !found; page++) {
        if (page > 1) await pause(300)
        const start = latest - page * 100
        const batch = await aptosGet<RawTx[]>(`/transactions?limit=100&start=${start}`)
        found =
          (batch ?? []).find(
            t => t.type === "user_transaction" && t.success === false && (t.vm_status ?? "").includes("Move abort")
          ) ?? null
      }
    }
    if (found?.hash) {
      const tx = await getAptosTransactionByHash(found.hash)
      const ok =
        tx !== null &&
        tx.success === false &&
        tx.decodedAbort !== undefined &&
        tx.decodedAbort.cause === "move_abort" &&
        tx.decodedAbort.reason.length > 0
      report(
        "tx by hash (failed, Move abort)",
        ok,
        tx?.decodedAbort ? `module=${tx.decodedAbort.module} code=${tx.decodedAbort.code}` : "decodedAbort missing"
      )
    } else {
      skip("tx by hash (failed, Move abort)", "no failed tx in recent sample")
      const canned = decodeAbort("Move abort in 0x1::coin: 0x10006")
      const ok = canned.cause === "move_abort" && canned.errorName === "EINSUFFICIENT_BALANCE" && canned.reason.length > 0
      report("decodeAbort canned vm_status", ok, `cause=${canned.cause} errorName=${canned.errorName}`)
    }
  }

  await pause()
  {
    const framework = await getAccount("0x1")
    const missing = await getAccount("0x" + "f".repeat(62) + "fe")
    report(
      "getAccount",
      framework !== null && missing === null,
      `0x1 seq=${framework?.sequenceNumber ?? "null"}, nonexistent=${missing === null ? "null" : "unexpected"}`
    )
  }

  await pause()
  {
    const status = await getAptosNetworkStatus()
    report(
      "getAptosNetworkStatus",
      status.up === true,
      `up=${status.up} latestVersion=${status.latestVersion} secondsBehind=${status.secondsBehind}`
    )
  }

  await pause()
  {
    const diag = await diagnoseAptosWallet("0x1")
    report(
      "diagnoseAptosWallet(0x1)",
      diag.exists && diag.aptBalance !== null,
      `exists=${diag.exists} aptBalance=${diag.aptBalance} failures=${diag.recentFailureCount}`
    )
  }

  await pause()
  {
    const candidates = sampleSenders.slice(0, 5)
    let balanceOk = false
    let balanceDetail = "no candidate sender had a parseable APT balance"
    for (const sender of candidates) {
      const balance = await getAptosWalletBalance(sender)
      if (!balance) {
        await pause(300)
        continue
      }
      const parsed = parseFloat(balance.aptBalance)
      if (Number.isFinite(parsed) && parsed > 0) {
        balanceOk = true
        balanceDetail = `sender=${sender.slice(0, 12)}… apt=${balance.aptBalance} tokens=${balance.tokens.length}`
        break
      }
      await pause(300)
    }
    if (!balanceOk && (await indexerRateLimited())) {
      skip("indexer getAptosWalletBalance", "indexer rate-limited")
    } else {
      report("indexer getAptosWalletBalance", candidates.length > 0 && balanceOk, balanceDetail)
    }

    await pause()
    let historyOk = false
    let historyDetail = "no candidate sender returned history with functionId"
    for (const sender of candidates.slice(0, 3)) {
      const history = (await getAptosRecentTransactions(sender, undefined, 10)) ?? []
      const withFunction = history.find(tx => tx.functionId !== null)
      if (history.length >= 1 && withFunction) {
        historyOk = true
        historyDetail = `sender=${sender.slice(0, 12)}… txs=${history.length} functionId=${withFunction.functionId}`
        break
      }
      await pause(300)
    }
    if (!historyOk && (await indexerRateLimited())) {
      skip("indexer getAptosRecentTransactions", "indexer rate-limited")
    } else {
      report("indexer getAptosRecentTransactions", candidates.length > 0 && historyOk, historyDetail)
    }
  }

  if (failed) {
    console.log("\nRESULT: FAIL")
    process.exit(1)
  }
  console.log("\nRESULT: PASS")
}

main().catch(err => {
  console.error("verify-live crashed:", err)
  process.exit(1)
})
