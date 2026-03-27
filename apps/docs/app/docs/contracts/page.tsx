import type { Metadata } from "next"

export const metadata: Metadata = { title: "Smart Contracts" }

export default function ContractsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 not-prose">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Integration</p>
        <h1 className="text-3xl font-bold text-white">Smart Contracts</h1>
        <p className="mt-2 text-[#a1a1aa]">
          Let the AI answer questions about your on-chain contracts directly in chat.
        </p>
      </div>

      <h2>What it does</h2>
      <p>
        When you add a smart contract to your project, the AI support bot becomes aware of it.
        Users can ask questions like:
      </p>
      <ul>
        <li>&ldquo;Is my token locked?&rdquo;</li>
        <li>&ldquo;How long is the lock on the Team Finance contract?&rdquo;</li>
        <li>&ldquo;What is the liquidity locked in the vault?&rdquo;</li>
      </ul>
      <p>
        The AI uses the contract address, name, and description you provide — along with the user&apos;s
        connected wallet — to give accurate, protocol-specific answers.
      </p>

      <h2>Adding a contract</h2>
      <ol>
        <li>Open the dashboard and go to <strong>Smart Contracts</strong> in the sidebar.</li>
        <li>Click <strong>Add Contract</strong>.</li>
        <li>Fill in the fields:</li>
      </ol>

      <div className="not-prose overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#27272a]">
              <th className="py-2 pr-4 text-left font-semibold text-white">Field</th>
              <th className="py-2 text-left font-semibold text-white">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#a1a1aa]">
            {[
              ["Name", "A short, human-readable name. e.g. \"Team Finance Lock\""],
              ["Address", "The full 0x contract address on the target chain."],
              ["Chain", "The chain the contract is deployed on."],
              ["Description", "Explain what this contract does and what questions users might ask about it."],
            ].map(([field, desc]) => (
              <tr key={field} className="border-b border-[#1f1f1f]">
                <td className="py-2 pr-4 font-semibold text-[#e4e4e7] text-xs">{field}</td>
                <td className="py-2 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Writing good descriptions</h2>
      <p>
        The description is injected directly into the AI&apos;s system prompt. The more context you provide,
        the better the AI can answer. Good descriptions include:
      </p>
      <ul>
        <li>What the contract does (&ldquo;locks ERC-20 tokens for a vesting period&rdquo;)</li>
        <li>What users commonly ask (&ldquo;users ask whether their tokens are locked and when they unlock&rdquo;)</li>
        <li>Any important caveats (&ldquo;only the token owner can initiate an unlock&rdquo;)</li>
      </ul>

      <h3>Example — Team Finance lock contract</h3>
      <pre><code>{`Name:        Team Finance Lock
Address:     0x1234...abcd
Chain:       Ethereum
Description: This is Team Finance's token lock contract. Users lock
             ERC-20 tokens here for a specified duration. Common
             questions: "is my token locked?", "when does my lock
             expire?", "how do I unlock early?". The contract is
             read-only — only the original locker can initiate an
             unlock after the lock period expires.`}</code></pre>

      <h2>How the AI uses contracts</h2>
      <p>
        When a user asks a question, the AI receives a system prompt that includes all of your
        watched contracts. It knows:
      </p>
      <ul>
        <li>The contract&apos;s name, address, chain, and your description</li>
        <li>The user&apos;s connected wallet address (if they connected MetaMask)</li>
      </ul>
      <p>
        The AI can then give a specific, accurate answer — for example, linking to the contract
        on the explorer so the user can verify the lock themselves.
      </p>

      <div className="not-prose mt-8 rounded-xl border border-[#27272a] bg-[#111111] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a] mb-2">Tip</p>
        <p className="text-sm text-[#a1a1aa]">
          Encourage users to connect their wallet in the widget&apos;s Wallet tab before asking contract
          questions. With a wallet connected, the AI can give wallet-specific answers (e.g. &ldquo;your
          0x1234 address has 500,000 tokens locked until June 2025&rdquo;).
        </p>
      </div>
    </article>
  )
}
