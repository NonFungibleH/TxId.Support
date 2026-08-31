import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { FlowRail } from "@/components/sections/FlowRail";
import { ProductStage as Stage, ProductHero } from "@/components/sections/ProductStage";
import { ConsoleMockup } from "@/components/sections/ConsoleMockup";
import { ArrowRight, Inbox, Search, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Console: On-Chain Answers for Your Support Team | TxID",
  description:
    "The Console gives support agents the transaction, the diagnosis and the evidence beside the ticket they are already working. In development, shaped by our beta programme.",
  alternates: { canonical: "/console" },
};

/**
 * The Console is NOT built. The page says so once, prominently, and every CTA
 * is a conversation rather than a signup. A roadmap product written in the
 * present tense is the claim a technical buyer checks first, and remembers
 * longest when it turns out to be false.
 */
function Panel({ icon: Icon, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-surface p-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted mb-4">
        <Icon className="h-4 w-4 text-accent" />
      </span>
      <h3 className="font-display text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        <ProductHero
          eyebrow="TxID Console"
          status={{ label: "In development" }}
          title={<>Your support team, <span className="text-accent">with the chain in front of them</span></>}
          blurb="A console for managing failed transactions, connected to the CRM your team already works in. The agent sees the user's transaction, what actually happened, and the evidence behind it, without leaving the queue."
          actions={
            <div className="flex flex-wrap gap-3">
              <Button href="mailto:team@txid.support?subject=TxID Console" variant="primary" size="lg">
                Talk to us about the Console
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button href="/resolve" variant="outline" size="lg">
                Available today
              </Button>
            </div>
          }
        >
          <ConsoleMockup />
        </ProductHero>

        <div className="max-w-3xl mx-auto px-6 mb-14">
          <FadeIn>
            <div className="rounded-xl border border-[var(--border-accent)] bg-elevated p-5 text-center">
              <p className="text-sm text-muted leading-relaxed">
                The Console is being built now, shaped by the teams in our beta programme. It is not available to sign up for yet. If your support desk is where your on-chain questions land, we would like it shaped by you too.
              </p>
            </div>
          </FadeIn>
        </div>

        <FlowRail>
          <Stage
            n="01"
            who="The ticket arrives"
            title="A user says their transaction did not work"
            paras={[
              "It reaches your desk the way everything else does: an email, a chat, a form. What makes it different is that answering it needs somebody who can read a chain, and that person is usually not on the support rota.",
              "So the ticket waits. It gets escalated, or it gets an answer that is really a guess.",
            ]}
            emphasis="The bottleneck is never the queue. It is that one question in twenty needs an engineer."
            visualLabel="The queue"
          >
            <div className="grid gap-3">
              <Panel icon={Inbox} title="Where it lands today" body="A support agent reads a transaction hash they cannot interpret, and forwards it to someone who can." />
              <Panel icon={Search} title="What they actually need" body="What happened, whether funds moved, and who has to act next." />
            </div>
          </Stage>

          <Stage
            n="02"
            who="TxID Console"
            title="The transaction, read while the ticket sits open"
            flip
            paras={[
              "The agent pastes the hash, or it arrives with the ticket from your CRM. The Console reads the chain and returns the same resolution our API returns and our SDK renders.",
              "They see what happened, whether any funds moved, and whether anyone needs to act. No engineer, no explorer, no second tool.",
            ]}
            emphasis="Same engine as Resolve and Support, so your product and your support desk never tell a user two different stories."
            visualLabel="What the agent reads"
          >
            <div className="rounded-xl border border-[var(--border-accent)] bg-elevated p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] tracking-widest text-muted">TX-4102 · RESOLUTION</span>
                <span className="font-mono text-[10px] text-accent bg-accent-muted px-1.5 py-0.5 rounded">7201</span>
              </div>
              <p className="text-sm text-white leading-relaxed mb-3">
                That ETH/USD order had already left the book, so the update had nothing to change.
              </p>
              <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                {[["custody", "funds with user"], ["next action", "no action needed"], ["basis", "verified"]].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[11px] text-subtle">{k}</span>
                    <span className={`text-xs font-medium ${k === "basis" ? "text-teal" : "text-white"}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Stage>

          <Stage
            n="03"
            who="Your CRM"
            title="The answer goes back where the work already lives"
            paras={[
              "The resolution is written to the ticket in the system your team already uses, so nobody maintains a second queue and nothing has to be copied between tools.",
              "The reply the agent sends is the answer they were shown, not a paraphrase of it.",
            ]}
            visualLabel="Back to the ticket"
          >
            <div className="grid gap-3">
              <Panel icon={Inbox} title="Written to the ticket" body="The diagnosis and its evidence land on the case your agent already had open." />
              <Panel icon={Search} title="Countable, not anecdotal" body="Failures group by cause, so the same problem stops arriving twenty times." />
            </div>
          </Stage>

          <Stage
            n="04"
            who="Your compliance team"
            title="The record was kept while you worked"
            paras={[
              "Every case carries the conditions it was answered under: the chain state at the time, what was read, what could not be, and what the answer rested on.",
              "Nobody has to reconstruct it later, because reconstructing it later is how it gets reconstructed wrongly.",
            ]}
            visualLabel="The record"
          >
            <div className="grid gap-3">
              <Panel icon={ShieldCheck} title="Evidence, not recollection" body="The state the answer was true as of, kept with the answer rather than assembled from memory months afterwards." />
            </div>
          </Stage>

        </FlowRail>

        <section className="py-20 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                Help us build the right thing
              </h2>
              <p className="text-muted leading-relaxed mb-8">
                We are designing the Console with a small number of teams whose support desk already carries on-chain questions. There is no cost and no commitment while it is being built.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button href="mailto:team@txid.support?subject=TxID Console" variant="primary" size="lg">
                  Talk to us about the Console
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/resolve" variant="outline" size="lg">
                  See what is available today
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
