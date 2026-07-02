import type { Metadata } from "next"

export const metadata: Metadata = { title: "Smart Contracts" }

export default function ContractsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 not-prose">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Integration</p>
        <h1 className="text-3xl font-bold text-white">Smart Contracts</h1>
        <p className="mt-2 text-[#a1a1aa]">
          Let the AI answer questions about your on-chain contracts directly in chat, including
          diagnosing why transactions fail.
        </p>
      </div>

      <h2>What it does</h2>
      <p>
        When you add a smart contract to your project, the AI support bot becomes aware of it.
        Users can ask questions like:
      </p>
      <ul>
        <li>&ldquo;Is my token locked?&rdquo;</li>
        <li>&ldquo;My transaction failed — what happened?&rdquo;</li>
        <li>&ldquo;Why did my lock revert?&rdquo;</li>
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

      <p>
        When you paste a verified contract address, TxID Support reads the ABI from the block explorer
        and shows the contract&apos;s public function names as hints. These tell you exactly what actions
        users can perform on the contract, making it much easier to write a useful description.
      </p>

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

      <h2>Transaction diagnostics</h2>
      <p>
        When a user reports a failed transaction, the AI automatically fetches the transaction
        receipt, replays it on-chain to extract the revert reason, and explains it in plain English.
        You don&apos;t need to configure anything for this to work.
      </p>
      <p>Examples of what the AI can say:</p>
      <ul>
        <li>&ldquo;Your transaction failed because you didn&apos;t set a high enough gas limit in your wallet settings.&rdquo;</li>
        <li>&ldquo;The contract rejected this because the slippage tolerance was exceeded — try increasing your slippage to 1% and retrying.&rdquo;</li>
        <li>&ldquo;The RPC your wallet is using may be down or rate-limited. Try switching to a public RPC from Chainlist.org.&rdquo;</li>
      </ul>

      <p>
        Diagnostics work automatically for standard Solidity errors (<code>Error(string)</code> reverts)
        and out-of-gas failures. For contracts that use <strong>custom errors</strong> (e.g. <code>SlippageTooHigh()</code>),
        the AI needs the contract&apos;s ABI to decode them — see the ABI section below.
      </p>

      <h2>ABI upload</h2>
      <p>
        The ABI (Application Binary Interface) lets the AI decode custom Solidity errors into human-readable names.
        Without it, custom errors appear as raw hex and the AI can only give a generic response.
      </p>

      <p>When you add a contract, TxID Support automatically checks the block explorer for a verified ABI.
        The contract card will show one of three states:</p>

      <div className="not-prose overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#27272a]">
              <th className="py-2 pr-4 text-left font-semibold text-white">Status</th>
              <th className="py-2 text-left font-semibold text-white">What it means</th>
            </tr>
          </thead>
          <tbody className="text-[#a1a1aa]">
            {[
              ["Verified on block explorer", "ABI was fetched automatically. Custom errors are decoded. No action needed."],
              ["ABI uploaded manually", "You pasted the ABI. Custom errors are decoded."],
              ["No ABI found", "The contract is unverified and no ABI was uploaded. Custom errors show as raw hex."],
            ].map(([status, desc]) => (
              <tr key={status} className="border-b border-[#1f1f1f]">
                <td className="py-2 pr-4 font-semibold text-[#e4e4e7] text-xs">{status}</td>
                <td className="py-2 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>If no ABI is found automatically, you have two options:</p>
      <ul>
        <li><strong>Check block explorer:</strong> Re-triggers the automatic lookup. Use this if you recently verified the contract.</li>
        <li><strong>Paste ABI:</strong> Copy the ABI JSON from your deployment artifacts or Hardhat/Foundry output and paste it into the text field. Only the error definitions are needed, but pasting the full ABI is fine.</li>
      </ul>

      <h2>Error glossary</h2>
      <p>
        The error glossary lets you define exactly what the AI says when a specific error occurs.
        This is useful when the Solidity error name is cryptic or when you want to give users
        step-by-step guidance tailored to your protocol.
      </p>
      <p>
        If the contract has an ABI, TxID Support reads the custom error definitions from it and
        shows you a list of errors that don&apos;t have explanations yet. Click any error to expand
        it and write a plain-English explanation. You only need to write the explanation itself
        — the error name is pre-filled from the ABI, so there is no chance of a typo.
      </p>
      <p>
        For contracts without a verified ABI, you can still add entries manually by entering the
        error name and explanation yourself.
      </p>
      <p>
        For each entry, provide the error name (e.g. <code>SlippageTooHigh</code>) and a plain-English explanation.
        When the AI encounters that error in a failed transaction, it uses your explanation verbatim.
      </p>

      <h3>Example glossary entries</h3>
      <div className="not-prose overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#27272a]">
              <th className="py-2 pr-4 text-left font-semibold text-white">Error name</th>
              <th className="py-2 text-left font-semibold text-white">Explanation shown to user</th>
            </tr>
          </thead>
          <tbody className="text-[#a1a1aa]">
            {[
              ["SlippageTooHigh", "The price moved too much between when you clicked and when your transaction was processed. Go back, set your slippage tolerance to 1–2%, and try again."],
              ["LockNotExpired", "Your tokens are still within the lock period. Check your lock end date and try again after it expires."],
              ["InsufficientAllowance", "You haven't approved this contract to spend your tokens yet. Click 'Approve' first, wait for that transaction to confirm, then try again."],
            ].map(([err, exp]) => (
              <tr key={err} className="border-b border-[#1f1f1f]">
                <td className="py-2 pr-4 font-mono text-[#e4e4e7] text-xs">{err}</td>
                <td className="py-2 text-xs">{exp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>How the AI uses contracts</h2>
      <p>
        When a user asks a question, the AI receives a system prompt that includes all of your
        watched contracts. It knows:
      </p>
      <ul>
        <li>The contract&apos;s name, address, chain, and your description</li>
        <li>The ABI (if available), used to decode custom errors</li>
        <li>The error glossary, used to give exact explanations for known errors</li>
        <li>The user&apos;s connected wallet address (if they connected MetaMask)</li>
      </ul>

      <div className="not-prose mt-8 rounded-xl border border-[#27272a] bg-[#111111] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a] mb-2">Tip</p>
        <p className="text-sm text-[#a1a1aa]">
          Encourage users to connect their wallet in the widget&apos;s Wallet tab before asking contract
          questions. With a wallet connected, the AI can look up their recent transactions and give
          wallet-specific answers — including exactly why a specific transaction failed.
        </p>
      </div>
    </article>
  )
}
