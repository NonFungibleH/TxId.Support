// Curated demo protocols for the public /check "try it live" page. The page
// sends a protocol id; the chat route expands it to these contracts, fetches
// their ABIs, and scopes the demo bot to them (reusing the inspect mechanism).
// All addresses verified as deployed contracts on their chain.

export interface DemoContract {
  name: string
  address: string
  chain: string // hex chain id
}

export interface DemoProtocol {
  id: string
  label: string
  contracts: DemoContract[]
}

const UNISWAP_DESC =
  "A Uniswap router contract. User swaps on Uniswap are routed through it, so it's what a user's swap transactions interact with."
const PANCAKE_DESC =
  "A PancakeSwap router contract. User swaps on PancakeSwap are routed through it, so it's what a user's swap transactions interact with."

export const DEMO_PROTOCOLS: Record<string, DemoProtocol> = {
  uniswap: {
    id: "uniswap",
    label: "Uniswap",
    contracts: [
      { name: "Universal Router", address: "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af", chain: "0x1" },
      { name: "Universal Router (legacy)", address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", chain: "0x1" },
      { name: "SwapRouter02", address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", chain: "0x1" },
      { name: "Universal Router", address: "0x6fF5693b99212Da76ad316178A184AB56D299b43", chain: "0x2105" },
      { name: "SwapRouter02", address: "0x2626664c2603336E57B271c5C0b26F421741e481", chain: "0x2105" },
      { name: "Universal Router", address: "0x5E325eDA8064b456f4781070C0738d849c824258", chain: "0xa4b1" },
      { name: "SwapRouter02", address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", chain: "0xa4b1" },
      { name: "Universal Router", address: "0x643770E279d5D0733F21d6DC03A8efbABf3255B4", chain: "0x89" },
      { name: "SwapRouter02", address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", chain: "0x89" },
    ],
  },
  pancakeswap: {
    id: "pancakeswap",
    label: "PancakeSwap",
    contracts: [
      { name: "PancakeSwap V2 Router", address: "0x10ED43C718714eb63d5aA57B78B54704E256024E", chain: "0x38" },
      { name: "PancakeSwap Smart Router", address: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4", chain: "0x38" },
    ],
  },
}

/** Contracts to scope the demo bot to. Prefers the wallet's chain; falls back to
 *  all of the protocol's contracts so the bot is always "the protocol". */
export function demoContractsFor(protocolId: string, chainHex?: string): DemoContract[] {
  const p = DEMO_PROTOCOLS[protocolId]
  if (!p) return []
  if (chainHex) {
    const onChain = p.contracts.filter((c) => c.chain === chainHex)
    if (onChain.length > 0) return onChain
  }
  return p.contracts
}

export function demoContractDescription(protocolId: string): string {
  return protocolId === "pancakeswap" ? PANCAKE_DESC : UNISWAP_DESC
}
