import { getNativeBalance, getTokenBalances, CHAIN_CONFIGS } from "@txid/blockchain"
import { formatWalletContext } from "@txid/ai"

// Allow cross-origin requests from any embedded site
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Fetch wallet balances from Moralis and return a formatted context string.
 * Called client-side by the widget after the user connects their wallet.
 *
 * GET /api/wallet-context?address=0x...&chainId=0x1
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")
    const chainId = searchParams.get("chainId") ?? "0x1"

    // Basic address validation
    if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
      return Response.json(
        { error: "Invalid wallet address" },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const chainConfig = CHAIN_CONFIGS[chainId]
    if (!chainConfig) {
      // Unknown chain — still try with Ethereum config rather than erroring
      return Response.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // Fetch native balance and token balances in parallel
    // Token balance fetch is best-effort — never block on it
    const [native, tokens] = await Promise.all([
      getNativeBalance(address, chainId),
      getTokenBalances(address, chainId).catch(() => []),
    ])

    const context = formatWalletContext(
      address,
      chainConfig.name,
      native.symbol,
      native.balanceFormatted,
      tokens,
    )

    return Response.json(
      {
        context,
        native,
        tokens: tokens.slice(0, 15),
        chain: { id: chainId, name: chainConfig.name },
      },
      { headers: CORS_HEADERS },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch wallet data"
    console.error("[wallet-context]", err)
    return Response.json(
      { error: msg },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
