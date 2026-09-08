/**
 * Point the real client at real HyperCore accounts and print what a user would
 * be told. No mocks. Run it before trusting anything in this package.
 *
 *   npx tsx packages/hyperliquid/scripts/verify-live.ts
 */
import { getHyperliquidAccount, getHyperliquidFills, getHyperliquidOrders } from "../src/client"
import { explainStatus, isFailure } from "../src/statuses"

const KNOWN_TRADER = "0x31ca8395cf837de08b24da3f660e77761dfb974b"

async function main() {
  const acct = await getHyperliquidAccount(KNOWN_TRADER)
  console.log("=== account ===")
  if (acct.kind !== "ok") { console.log(`  ${acct.kind}`) } else {
    const a = acct.value
    console.log(`  value $${a.accountValue}, withdrawable $${a.withdrawable}, margin used $${a.totalMarginUsed}`)
    console.log(`  ${a.positions.length} positions, ${a.spot.length} spot balances, neverTraded=${a.neverTraded}`)
    for (const p of a.positions.slice(0, 3)) {
      console.log(`    ${p.coin.padEnd(6)} ${p.direction.toUpperCase().padEnd(5)} size ${p.size.padEnd(12)} entry ${p.entryPrice} uPnL ${p.unrealizedPnl} liq ${p.liquidationPrice} ${p.leverage}`)
    }
  }

  console.log("\n=== orders, and what the user is told ===")
  const orders = await getHyperliquidOrders(KNOWN_TRADER, 100)
  if (orders.kind !== "ok") { console.log(`  ${orders.kind}`) } else {
    const failed = orders.value.filter(o => isFailure(o.status))
    console.log(`  ${orders.value.length} orders, ${failed.length} did not stand`)
    const seen = new Set<string>()
    for (const o of failed) {
      if (seen.has(o.status)) continue
      seen.add(o.status)
      console.log(`\n  ${o.status}  (${o.statusKind})  ${o.coin} ${o.side} ${o.size} @ ${o.limitPrice ?? "market"}, tif ${o.timeInForce}, ${o.age ?? "?"}`)
      console.log(`     ANSWER  ${o.reason ?? "(no wording held, honest floor)"}`)
    }
    if (failed.length === 0) console.log("  none in this window")
  }

  console.log("\n=== fills ===")
  const fills = await getHyperliquidFills(KNOWN_TRADER, 3)
  if (fills.kind !== "ok") console.log(`  ${fills.kind}`)
  else for (const f of fills.value) console.log(`  ${f.coin} ${f.direction} ${f.size} @ ${f.price}, pnl ${f.closedPnl}, fee ${f.fee}, ${f.age}`)

  // NOT a vanity address. 0x1111…1111 looks unused and is not: it holds real
  // spot balances people have sent it, so it correctly reports neverTraded
  // false. Checking against it would have "proved" a bug that was not there.
  console.log("\n=== an address that has never traded here ===")
  const FRESH = "0x" + "ab".repeat(20)
  const fresh = await getHyperliquidAccount(FRESH)
  console.log(`  ${fresh.kind}` + (fresh.kind === "ok" ? `, neverTraded=${fresh.value.neverTraded} (must be TRUE, and must not read as an outage)` : ""))
  const freshOrders = await getHyperliquidOrders(FRESH)
  console.log(`  orders: ${freshOrders.kind}` + (freshOrders.kind === "ok" ? `, ${freshOrders.value.length} rows` : ""))

  console.log("\n=== a status we hold no wording for ===")
  const u = explainStatus("someStatusWeHaveNeverSeen")
  console.log(`  kind=${u.kind}, reason=${u.reason} (must be unknown/null, never a guess)`)
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
