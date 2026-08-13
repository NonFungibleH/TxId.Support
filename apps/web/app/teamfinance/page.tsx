import type { Metadata } from "next";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";
import { WidgetMockup } from "@/components/sections/WidgetMockup";
import { ApiCallMockup } from "@/components/sections/ApiCallMockup";
import { TrustMockup } from "@/components/sections/TrustMockup";
import { Reveal } from "./Reveal";
import { Rail } from "./Rail";
import { Pricing } from "./Pricing";

/**
 * TxID × Team Finance partnership landing page.
 *
 * Structured like the site's /how-it-works page: intro the product, then walk a
 * cold visitor through one question end to end along a vertical tracing RAIL
 * (Team Finance blue), each numbered stage paired with a LIVE product animation
 * reused from the marketing site, and finish with who it is for and a strong CTA.
 *
 * Reads as a genuine Team Finance page: Inter (their brand face, already loaded),
 * their flat brand blue #1863DC with no gradients, their official logo, and an
 * all-light world. TxID's dark identity appears only inside the product shots,
 * which is correct: that is the product itself.
 *
 * COPY RULE: custom branded, never "co-branded"; "evidence-backed", never
 * "verified"; no em dashes. NOINDEX: partner pitch page shared by link.
 */

const ONBOARD =
  "mailto:team@txid.support?subject=TxID%20%C3%97%20Team%20Finance%20onboarding&body=Hi%20TxID%20team%2C%20we%20came%20from%20Team%20Finance%20and%20would%20like%20to%20add%20the%20support%20agent%20to%20our%20token.";

const BLUE = "#1863DC";
const BLUE_HOVER = "#0F4CAF";
const BLUE_TINT = "#EAF1FC";
const INK = "#101223";
const BODY = "#4B5063";

export const metadata: Metadata = {
  title: "TxID × Team Finance: on-chain support that investigates what happened",
  description:
    "Add a custom-branded TxID support agent to your Team Finance project. It investigates failed transactions, reads your contracts and docs, and gives holders evidence-backed answers 24/7.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "TxID × Team Finance",
    description:
      "You secured your token. Now give your holders answers they can trust. A custom-branded, evidence-backed support agent for Team Finance projects.",
    type: "website",
    url: "https://txid.support/teamfinance",
    siteName: "TxID",
  },
};

function TxidMark({ size = 22 }: { size?: number }) {
  // The REAL TxID icon, same asset the marketing site uses, not a stand-in.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/txid-icon-64.png" alt="" aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), display: "block", flex: "none" }} />;
}

function TeamFinanceLogo({ height = 20 }: { height?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/teamfinance-logotype.svg" alt="Team Finance" style={{ height, width: "auto", display: "block" }} />;
}

/** A dark product animation floated in a light frame, Team Finance style. */
function ProductShot({ children, maxWidth = 440 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center", minWidth: 0 }}>
      <div style={{ position: "relative", width: "100%", maxWidth }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: "9% -5% -7% 6%", background: BLUE_TINT, borderRadius: 20 }} />
        <div style={{ position: "relative", filter: "drop-shadow(0 26px 50px rgba(16,18,35,0.22))" }}>{children}</div>
      </div>
    </div>
  );
}

/** A light UI card floated with a soft shadow (for stages without a dark mockup). */
function LightShot({ children, maxWidth = 420 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center", minWidth: 0 }}>
      <div style={{ position: "relative", width: "100%", maxWidth }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: "9% -5% -7% 6%", background: BLUE_TINT, borderRadius: 20 }} />
        <div style={{ position: "relative", background: "#fff", border: "1px solid #EDEFF6", borderRadius: 16, boxShadow: "0 26px 50px -20px rgba(16,18,35,0.20)" }}>{children}</div>
      </div>
    </div>
  );
}

/** Stage 03 visual: the evidence-backed answer the holder sees, in your branding. */
function AnswerCard() {
  return (
    <LightShot maxWidth={420}>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, paddingBottom: 13, borderBottom: "1px solid #F1F3F8" }}>
          <TxidMark size={24} />
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Your support agent</div>
          <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: "#22A06B", background: "#E7F6EF", borderRadius: 6, padding: "3px 8px" }}>RESOLVED</span>
        </div>
        <p style={{ margin: "13px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "#2C3345" }}>
          The price moved past your 0.3% slippage tolerance, so the contract rejected the swap. No funds left your
          wallet. <span style={{ color: BLUE, fontWeight: 600 }}>Fix: retry with slippage at 0.5%.</span>
        </p>
        <div style={{ marginTop: 13, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: "#8A8FA3", textTransform: "uppercase" }}>Evidence</div>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {[
            { k: "Transaction", v: "0x8f2a…e41c" },
            { k: "Pool state", v: "block 21944258" },
            { k: "Lock & vesting", v: "team.finance" },
          ].map((r) => (
            <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: "#F7F8FC", border: "1px solid #EDEFF6", borderRadius: 8, padding: "8px 11px" }}>
              <span style={{ fontSize: 12.5, color: "#5A6076" }}>{r.k}</span>
              <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono-accent), ui-monospace, monospace", color: BLUE }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </LightShot>
  );
}

/** Stage 04 visual: only what needs a human reaches your team, in your tools. */
function RoutingCard() {
  return (
    <LightShot maxWidth={420}>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 14 }}>What reaches your team</div>
        <div style={{ display: "grid", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F7F8FC", border: "1px solid #EDEFF6", borderRadius: 9, padding: "11px 13px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22A06B", flex: "none" }} />
            <span style={{ fontSize: 13, color: "#5A6076" }}>Routine on-chain questions</span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#22A06B" }}>Resolved by TxID</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${BLUE}33`, borderRadius: 9, padding: "11px 13px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: BLUE, flex: "none" }} />
            <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>Genuinely needs a human</span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: BLUE }}>Escalated</span>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: "#8A8FA3", textTransform: "uppercase" }}>Sent to your tools</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
          {["Slack", "Discord", "Telegram", "Linear", "GitHub", "Jira"].map((t) => (
            <span key={t} style={{ fontSize: 12, color: "#33374D", background: "#F4F7FD", border: "1px solid #E3EAF7", borderRadius: 7, padding: "5px 10px" }}>{t}</span>
          ))}
        </div>
      </div>
    </LightShot>
  );
}

/** One numbered stage of the walkthrough, hung off the tracing rail. */
function Stage({ n, who, title, body, reverse, children }: {
  n: string; who: string; title: string; body: string; reverse?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="tf-stage">
      <div className={`tf-row${reverse ? " reverse" : ""}`} style={{ width: "100%", maxWidth: 1080, margin: "0 auto" }}>
        <div className="tf-row-copy">
          <div className="tf-stage-num">{n} <span style={{ color: "#B9C0CF" }}>·</span> {who}</div>
          <h2 style={{ margin: "0 0 14px", fontSize: "clamp(23px,2.6vw,30px)", lineHeight: 1.22, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>{title}</h2>
          <p style={{ margin: 0, fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.7, color: BODY, maxWidth: 480 }}>{body}</p>
        </div>
        <div className="tf-row-media">{children}</div>
      </div>
    </div>
  );
}

export default function TeamFinancePage() {
  return (
    <div
      className="tf"
      style={{ position: "relative", zIndex: 10, background: "#fff", color: INK, fontFamily: "var(--font-inter), system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
.tf { scroll-behavior: smooth; }
.tf a { text-decoration: none; }
.tf [id] { scroll-margin-top: 80px; }
.tf .tf-btn, .tf .tf-btn-outline, .tf .tf-btn-white, .tf .tf-link, .tf .tf-link-violet, .tf .tf-nav, .tf .tf-foot, .tf .tf-card {
  transition: background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.tf .tf-btn:hover { background: ${BLUE_HOVER} !important; }
.tf .tf-btn-outline:hover { border-color: ${BLUE} !important; color: ${BLUE} !important; }
.tf .tf-btn-white:hover { background: ${BLUE_TINT} !important; }
.tf .tf-link:hover, .tf .tf-nav:hover { color: ${BLUE_HOVER} !important; }
.tf .tf-link-violet:hover { color: #4B2FE0 !important; }
.tf .tf-foot:hover { color: ${INK} !important; }
.tf .tf-nav { padding: 6px 0; }
.tf a:focus-visible { outline: 2px solid ${BLUE}; outline-offset: 3px; border-radius: 4px; }
.tf .tf-card { box-shadow: 0 8px 24px -18px rgba(16,18,35,0.16); }
.tf .tf-card:hover { transform: translateY(-3px); border-color: rgba(24,99,220,0.35) !important; box-shadow: 0 22px 44px -22px rgba(24,99,220,0.28); }
.tf .tf-chip { background: linear-gradient(135deg, #EAF1FC 0%, #DCE9FB 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 6px -2px rgba(24,99,220,0.25); }
.tf details.tf-faq { background: #fff; border: 1px solid #EDEFF6; border-radius: 12px; box-shadow: 0 8px 24px -18px rgba(16,18,35,0.14); }
.tf details.tf-faq summary { cursor: pointer; list-style: none; padding: 18px 20px; font-weight: 600; font-size: 15.5px; color: #101223; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.tf details.tf-faq summary::-webkit-details-marker { display: none; }
.tf details.tf-faq summary::after { content: "+"; font-size: 20px; color: #1863DC; flex: none; }
.tf details.tf-faq[open] summary::after { content: "−"; }
.tf details.tf-faq p { margin: 0; padding: 0 20px 18px; font-size: 14.5px; line-height: 1.65; color: #4B5063; }
@media (prefers-reduced-motion: reduce) { .tf .tf-card:hover { transform: none; } }
/* Alternating copy / product-shot rows; copy first on mobile for reading order. */
.tf .tf-row { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(36px,5vw,72px); align-items: center; }
.tf .tf-row.reverse .tf-row-copy { order: 2; }
.tf .tf-row.reverse .tf-row-media { order: 1; }
@media (max-width: 860px) {
  .tf .tf-row { grid-template-columns: 1fr; gap: 32px; }
  .tf .tf-row .tf-row-copy, .tf .tf-row.reverse .tf-row-copy { order: 1; }
  .tf .tf-row .tf-row-media, .tf .tf-row.reverse .tf-row-media { order: 2; }
}
/* The tracing rail (Rail.tsx) + the stages hung off it. */
.tf .tf-rail-line { position: absolute; left: 20px; top: 6px; bottom: 6px; width: 1px; background: #DCE0EC; pointer-events: none; }
.tf .tf-rail-fill { position: absolute; left: 20px; top: 6px; width: 2px; transform: translateX(-0.5px); background: linear-gradient(to bottom, rgba(24,99,220,0.25), ${BLUE}); box-shadow: 0 0 12px rgba(24,99,220,0.35); pointer-events: none; }
.tf .tf-rail-dot { position: absolute; left: 20px; transform: translate(-50%,-50%); z-index: 3; pointer-events: none; }
.tf .tf-rail-dot span { display: block; width: 12px; height: 12px; border-radius: 50%; background: ${BLUE}; box-shadow: 0 0 20px 6px rgba(24,99,220,0.4); }
.tf .tf-stage { padding: clamp(28px,4vw,44px) 24px clamp(28px,4vw,44px) 48px; }
.tf .tf-stage-num { font-family: var(--font-mono-accent), ui-monospace, monospace; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; color: ${BLUE}; margin-bottom: 14px; }
@media (min-width: 861px) {
  .tf .tf-rail-line, .tf .tf-rail-fill, .tf .tf-rail-dot { left: 50%; }
  .tf .tf-stage { padding: clamp(24px,3vw,40px) 24px; min-height: 380px; display: flex; align-items: center; }
}
`,
        }}
      />

      {/* Header */}
      {/* Solid background, no backdrop-filter: sticky + backdrop-filter is a
          known Safari/Chrome rendering bug that left the header half-clipped
          after anchor jumps. */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid #EDEFF6" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <a href="https://team.finance" target="_blank" rel="noopener noreferrer" aria-label="Team Finance" style={{ display: "block" }}><TeamFinanceLogo height={19} /></a>
            <span style={{ width: 1, height: 18, background: "#DCE0EC" }} />
            <a href="https://txid.support" aria-label="TxID" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <TxidMark size={22} />
              <span style={{ fontSize: 16, fontWeight: 600, color: "#6C4CF7", letterSpacing: "-0.01em" }}>TxID</span>
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <a href="#how" className="tf-nav" style={{ fontSize: 14.5, color: "#33374D" }}>How it works</a>
            <a href="#who" className="tf-nav" style={{ fontSize: 14.5, color: "#33374D" }}>Who it&apos;s for</a>
            <a href="#pricing" className="tf-nav" style={{ fontSize: 14.5, color: "#33374D" }}>Pricing</a>
            <a href="#faq" className="tf-nav" style={{ fontSize: 14.5, color: "#33374D" }}>FAQ</a>
            <a href="#cta" className="tf-btn" style={{ background: BLUE, color: "#fff", fontSize: 14.5, fontWeight: 600, padding: "10px 18px", borderRadius: 8 }}>Talk to us</a>
          </div>
        </div>
      </header>

      {/* Hero / intro */}
      <section style={{ padding: "clamp(56px,7vw,96px) 24px clamp(40px,5vw,64px)" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: "clamp(36px,5vw,64px)", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(30px,3.6vw,42px)", lineHeight: 1.16, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              You secured your token. <span style={{ color: BLUE }}>Now give your holders answers they can trust.</span>
            </h1>
            <p style={{ margin: "20px 0 0", fontSize: "clamp(15px,1.15vw,16.5px)", lineHeight: 1.65, color: BODY, maxWidth: 520 }}>
              Add a custom-branded TxID support agent to your platform. It investigates transactions, reads your
              contracts and docs, and gives holders clear, evidence-backed answers 24/7, in your branding.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
              <a href="#cta" className="tf-btn" style={{ background: BLUE, color: "#fff", fontSize: 15, fontWeight: 600, padding: "14px 24px", borderRadius: 8 }}>Get started</a>
              <a href="#how" className="tf-btn-outline" style={{ border: "1px solid #DCE0EC", color: INK, fontSize: 15, fontWeight: 600, padding: "14px 24px", borderRadius: 8 }}>See how it works</a>
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: "#6C7085" }}>Special rates for Team Finance Pro customers.</p>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#8A8FA3", letterSpacing: "0.01em" }}>
              Read-only <span style={{ color: "#CBD2E0" }}>·</span> No custody <span style={{ color: "#CBD2E0" }}>·</span> Audit-logged <span style={{ color: "#CBD2E0" }}>·</span> No financial advice
            </p>
          </div>
          <ProductShot maxWidth={460}>
            <InvestigationMockup
              className="relative"
              caseSubtitle="Failed swap"
              steps={[
                { label: "Fetched transaction", detail: "0x8f2a…e41c" },
                { label: "Replayed against pool state", detail: "block 21944258" },
                { label: "Read lock & vesting schedule", detail: "team.finance" },
                { label: "Checked wallet impact", detail: "no funds moved" },
              ]}
            />
          </ProductShot>
        </Reveal>
      </section>

      {/* Lead-in: the questions the flow answers */}
      <section style={{ padding: "clamp(48px,6vw,80px) 24px clamp(16px,2vw,28px)" }}>
        <Reveal style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
            Follow one question, <span style={{ color: BLUE }}>from a confused holder to a compliance record.</span>
          </h2>
          <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>
            These are the questions that reach your team every day. Here is what happens when TxID is on your site.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 22 }}>
            {["Why did my swap fail?", "When can I claim my vested tokens?", "Is my transaction stuck?", "Why was my claim rejected?", "Is the liquidity actually locked?"].map((q) => (
              <span key={q} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#F7F8FC", border: "1px solid #EDEFF6", borderRadius: 999, padding: "8px 14px", fontSize: 13.5, color: INK }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: BLUE, flex: "none" }} />{q}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* The walkthrough — tracing rail with numbered stages */}
      <section id="how" style={{ padding: "clamp(16px,2vw,28px) 0 clamp(48px,6vw,80px)" }}>
        <Rail>
          <Stage
            n="01"
            who="Your holder"
            title="They ask, right inside your product."
            body="A swap fails, a claim is confusing, or they can't tell if a transaction went through. Instead of a support ticket and a day of waiting, they ask the agent on your site, in your branding."
          >
            <ProductShot maxWidth={400}><WidgetMockup className="relative" /></ProductShot>
          </Stage>

          <Stage
            n="02"
            who="TxID"
            title="It investigates what actually happened."
            body="TxID reads the real transaction, replays it against live chain state, and reads your Team Finance locks and vesting and your documentation, to find the cause and the evidence behind it, not a guess."
            reverse
          >
            <ProductShot maxWidth={430}><ApiCallMockup className="relative" /></ProductShot>
          </Stage>

          <Stage
            n="03"
            who="Your holder"
            title="They get a clear answer, instantly."
            body="What happened, why, and exactly what to do next, in plain English, with the evidence shown so they can check it themselves. No waiting for your team to wake up, and no guesswork."
          >
            <AnswerCard />
          </Stage>

          <Stage
            n="04"
            who="Your team"
            title="You only see what needs a human."
            body="The routine questions resolve themselves. The ones that genuinely need your team escalate with the full conversation attached, into the tools you already use."
            reverse
          >
            <RoutingCard />
          </Stage>

          <Stage
            n="05"
            who="Compliance & product"
            title="Every conversation becomes a trusted record."
            body="Read-only and never custodial, with every answer recording the transaction, contract state and sources it rested on. A reviewable, exportable trail your compliance team can stand behind."
          >
            <ProductShot maxWidth={380}><TrustMockup className="relative" /></ProductShot>
          </Stage>
        </Rail>
      </section>

      {/* Who it's for */}
      <section id="who" style={{ padding: "clamp(56px,7vw,96px) 24px", background: "#F7F8FC", borderTop: "1px solid #EDEFF6", borderBottom: "1px solid #EDEFF6" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 640, margin: "0 auto 44px", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Built for everyone around your token
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>
              Your holders get instant answers. Your support team gets its time back. Your compliance team gets the record.
            </p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 20 }}>
            {[
              { t: "For your holders", d: "A straight answer the moment a transaction fails or a claim is confusing, 24/7, in your branding, without leaving your site.", icon: (<><circle cx="12" cy="8" r="3.4" stroke={BLUE} strokeWidth="1.8" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></>) },
              { t: "For your support team", d: "The routine on-chain questions answer themselves, so your team only sees the conversations that actually need a human.", icon: (<><path d="M4 5.5h16v10H8l-4 3.5z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.5 9h7M8.5 12h4" stroke={BLUE} strokeWidth="1.6" strokeLinecap="round" /></>) },
              { t: "For your compliance team", d: "Every answer records the transaction, contract state and sources it rested on, as a reviewable trail you can export.", icon: (<><path d="M12 3l7 2.8v5.4c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V5.8L12 3Z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12l2.3 2.3L15.4 10" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>) },
            ].map((c) => (
              <div key={c.t} className="tf-card" style={{ height: "100%", background: "#fff", border: "1px solid #EDEFF6", borderRadius: 14, padding: 30 }}>
                <div className="tf-chip" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 12, marginBottom: 18 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">{c.icon}</svg>
                </div>
                <h3 style={{ margin: "0 0 9px", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{c.t}</h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: BODY }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported chains */}
      <section style={{ padding: "clamp(52px,6vw,84px) 24px" }}>
        <Reveal style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE, marginBottom: 10 }}>Chains</div>
          <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
            Support on the chains your holders use
          </h2>
          <p style={{ margin: "16px auto 0", maxWidth: 560, fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>
            Nine chains live today, EVM and Move-native Aptos. Every plan covers one; add any of the others for a flat fee.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 30 }}>
            {[
              { name: "Ethereum", file: "Ethereum.png" },
              { name: "Base", file: "Base.png" },
              { name: "BNB Chain", file: "BNB.png" },
              { name: "Polygon", file: "Polygon.png" },
              { name: "Arbitrum", file: "Arbitrum.png" },
              { name: "Optimism", file: "Optimism.png" },
              { name: "Avalanche", file: "Avalanche.png" },
              { name: "Etherlink", file: "Etherlink.png" },
              { name: "Aptos", file: "Aptos.png" },
            ].map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #E6E9F2", borderRadius: 999, padding: "9px 16px 9px 12px", boxShadow: "0 1px 2px rgba(16,18,35,0.04)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/chains/${c.file}`} alt="" aria-hidden="true" width={22} height={22} style={{ display: "block", borderRadius: 5, objectFit: "contain" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{c.name}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "24px auto 0", maxWidth: 520, fontSize: 14, lineHeight: 1.6, color: "#9AA0B4" }}>
            Need a network that is not listed? We can integrate additional chains on request.
          </p>
        </Reveal>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "clamp(56px,7vw,96px) 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 640, margin: "0 auto 40px", textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE, marginBottom: 10 }}>Pricing</div>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Priced per resolution, not per seat.
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>
              Traditional support desks bill per seat, and still need a person for every on-chain question. TxID
              resolves those automatically, so you pay for answers your holders actually got, not for headcount.
            </p>
          </Reveal>
          <Pricing />
        </div>
      </section>

      {/* About the partners */}
      <section style={{ padding: "0 24px clamp(56px,7vw,96px)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ marginBottom: 32, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(22px,2.5vw,28px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600 }}>Who&apos;s behind this</h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 20 }}>
            <Reveal>
              <div style={{ height: "100%", background: "#F7F8FC", borderRadius: 16, padding: "clamp(26px,2.6vw,34px)" }}>
                <div style={{ marginBottom: 16 }}><TeamFinanceLogo height={22} /></div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: BODY }}>
                  Team Finance provides audited token and liquidity locks, token launches, and vesting contracts across
                  28+ blockchains. It is where projects lock their liquidity and vest their team tokens to say no to
                  rug-pulls and show their community the fundamentals are secured, trusted by 40,000+ projects.
                </p>
                <a href="https://team.finance" target="_blank" rel="noopener noreferrer" className="tf-link" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, fontSize: 14.5, fontWeight: 600, color: BLUE }}>team.finance <span aria-hidden="true">&rsaquo;</span></a>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <div style={{ height: "100%", background: "#F7F8FC", borderRadius: 16, padding: "clamp(26px,2.6vw,34px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <TxidMark size={22} />
                  <span style={{ fontSize: 17, fontWeight: 600, color: "#6C4CF7", letterSpacing: "-0.01em" }}>TxID</span>
                </div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: BODY }}>
                  TxID is the support layer for on-chain finance. It gives a protocol&apos;s users an AI support agent
                  that reads its contracts, documentation and live chain state, answers with the evidence behind every
                  claim, and keeps a reviewable record of every conversation.
                </p>
                <a href="https://txid.support" className="tf-link-violet" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, fontSize: 14.5, fontWeight: 600, color: "#6C4CF7" }}>txid.support <span aria-hidden="true">&rsaquo;</span></a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "0 24px clamp(64px,8vw,110px)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Reveal style={{ marginBottom: 28, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600 }}>Frequently asked questions</h2>
          </Reveal>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { q: "What does TxID need access to?", a: "Nothing sensitive. TxID reads public chain state, your verified contracts and the documentation you point it at. It is read-only: it never holds funds or keys, and it cannot move anything." },
              { q: "What if it doesn't know the answer?", a: "It says so, and escalates. When a question needs a human, the full conversation lands with your team in the tools you already use (Slack, Telegram, Linear, GitHub, Jira). It never guesses at an answer it cannot back with evidence." },
              { q: "How do we know the answers are right?", a: "Every answer is built from what TxID actually read: the transaction, live contract state and your docs, and it shows those sources so a holder can check them. Answers with nothing behind them are flagged to your team, not dressed up." },
              { q: "How does this help with compliance?", a: "Every conversation is kept as a reviewable record: what was asked, what was answered, and the exact chain state and sources each answer rested on, exportable when an auditor or regulator asks. Support stops being a black box." },
              { q: "How long does setup take?", a: "Onboarding is hands-on: you share your token, contracts and docs; we connect TxID and set your branding; you add one line to your site. Most projects are live the same day." },
              { q: "What does it cost?", a: "You pay per resolved conversation, not per seat, with special rates for Team Finance Pro projects. Talk to us and we will size it to your holder base." },
            ].map((f) => (
              <details key={f.q} className="tf-faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Strong final CTA */}
      <section id="cta" style={{ padding: "0 24px clamp(64px,8vw,110px)" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", background: BLUE, borderRadius: 18, padding: "clamp(44px,6vw,72px) clamp(24px,4vw,48px)", textAlign: "center", color: "#fff" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(26px,3vw,38px)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
            Give your holders answers they can verify.
          </h2>
          <p style={{ margin: "16px auto 0", maxWidth: 540, fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: "rgba(255,255,255,0.88)" }}>
            Add TxID to your Team Finance project and give your community 24/7 support for the on-chain questions that
            normally reach your team.
          </p>
          <a href={ONBOARD} className="tf-btn-white" style={{ display: "inline-flex", alignItems: "center", gap: 9, marginTop: 28, background: "#fff", color: BLUE, fontSize: 15, fontWeight: 600, padding: "15px 28px", borderRadius: 8 }}>
            Get started <span aria-hidden="true">&rarr;</span>
          </a>
          <p style={{ margin: "18px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Special rates for Team Finance Pro customers.</p>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #EDEFF6", padding: "clamp(40px,5vw,56px) 24px 32px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 32 }}>
          <div style={{ maxWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <a href="https://team.finance" target="_blank" rel="noopener noreferrer" aria-label="Team Finance"><TeamFinanceLogo height={16} /></a>
              <span style={{ width: 1, height: 15, background: "#DCE0EC" }} />
              <a href="https://txid.support" aria-label="TxID" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TxidMark size={20} />
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "#6C4CF7" }}>TxID</span>
              </a>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#6C7085" }}>
              TxID is an AI support agent that investigates on-chain questions and answers with the evidence behind them.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 12 }}>Product</div>
            <div style={{ display: "grid", gap: 9, fontSize: 13.5 }}>
              <a href="#how" className="tf-foot" style={{ color: "#6C7085" }}>How it works</a>
              <a href="#who" className="tf-foot" style={{ color: "#6C7085" }}>Who it&apos;s for</a>
              <a href="#pricing" className="tf-foot" style={{ color: "#6C7085" }}>Pricing</a>
              <a href="#faq" className="tf-foot" style={{ color: "#6C7085" }}>FAQ</a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 12 }}>Partners</div>
            <div style={{ display: "grid", gap: 9, fontSize: 13.5 }}>
              <a href="https://txid.support" className="tf-foot" style={{ color: "#6C7085" }}>txid.support</a>
              <a href="https://team.finance" target="_blank" rel="noopener noreferrer" className="tf-foot" style={{ color: "#6C7085" }}>team.finance</a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 12 }}>Legal</div>
            <div style={{ display: "grid", gap: 9, fontSize: 13.5 }}>
              <a href="/privacy" className="tf-foot" style={{ color: "#6C7085" }}>Privacy</a>
              <a href="/terms" className="tf-foot" style={{ color: "#6C7085" }}>Terms</a>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1160, margin: "clamp(28px,3vw,40px) auto 0", paddingTop: 20, borderTop: "1px solid #EDEFF6", fontSize: 12.5, color: "#8A8FA3" }}>
          A partnership between TxID and Team Finance.
        </div>
      </footer>
    </div>
  );
}
