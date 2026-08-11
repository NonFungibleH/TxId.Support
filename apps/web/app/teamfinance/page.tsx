import type { Metadata } from "next";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";
import { WidgetMockup } from "@/components/sections/WidgetMockup";
import { ApiCallMockup } from "@/components/sections/ApiCallMockup";
import { TrustMockup } from "@/components/sections/TrustMockup";
import { Reveal } from "./Reveal";

/**
 * TxID × Team Finance partnership landing page.
 *
 * A cold visitor arrives from team.finance never having heard of TxID, so this
 * page has to SHOW the product working, not just describe it. It is built to
 * read as a genuine Team Finance page:
 *   - Inter (their actual brand face, already loaded site-wide), not a stand-in.
 *   - Their real flat brand blue #1863DC, no gradients (their UI has none).
 *   - Their signature layout device: alternating copy / floating-product-shot
 *     rows. Here the "screenshots" are the widget's own LIVE animations reused
 *     from the marketing site (InvestigationMockup, WidgetMockup, ApiCallMockup,
 *     TrustMockup), floated in light frames with a soft shadow.
 *   - Their official logo (public/brand/teamfinance-logotype.svg) and an all-
 *     light world; TxID's dark identity appears only inside the product shots,
 *     which is correct: that is the product itself.
 *
 * COPY RULE: the agent is CUSTOM BRANDED to each project's platform, never
 * "co-branded". Say "evidence-backed", never "verified". No em dashes.
 *
 * NOINDEX: partner pitch page shared by link (a Vercel preview), kept out of the
 * index and the sitemap.
 */

const ONBOARD =
  "mailto:team@txid.support?subject=TxID%20%C3%97%20Team%20Finance%20onboarding&body=Hi%20TxID%20team%2C%20we%20came%20from%20Team%20Finance%20and%20would%20like%20to%20add%20the%20support%20agent%20to%20our%20token.";

// Team Finance's real UI blue (flat, from their live buttons), plus a darker
// hover taken from their logotype gradient's deep stop.
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
  const radius = size >= 24 ? 7 : 6;
  const glyph = Math.round(size * 0.62);
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: "#6C4CF7", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <svg width={glyph} height={glyph} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M1.8 8.5h2.7l1.5-3.8 2.2 6.8 1.5-3h4.3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Team Finance's official blue logotype (from their brand kit). */
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

function BlueLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="tf-link" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 22, fontSize: 15, fontWeight: 600, color: BLUE }}>
      {children} <span aria-hidden="true">&rsaquo;</span>
    </a>
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
.tf .tf-card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -24px rgba(16,18,35,0.26); }
@media (prefers-reduced-motion: reduce) { .tf .tf-card:hover { transform: none; } }
/* Alternating copy / product-shot rows, Team Finance style. Copy always first
   on mobile for reading order, regardless of the desktop side. */
.tf .tf-row { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(36px,5vw,80px); align-items: center; }
.tf .tf-row.reverse .tf-row-copy { order: 2; }
.tf .tf-row.reverse .tf-row-media { order: 1; }
@media (max-width: 860px) {
  .tf .tf-row { grid-template-columns: 1fr; gap: 40px; }
  .tf .tf-row .tf-row-copy, .tf .tf-row.reverse .tf-row-copy { order: 1; }
  .tf .tf-row .tf-row-media, .tf .tf-row.reverse .tf-row-media { order: 2; }
}
`,
        }}
      />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.88)", backdropFilter: "saturate(180%) blur(12px)", WebkitBackdropFilter: "saturate(180%) blur(12px)", borderBottom: "1px solid #EDEFF6" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <TxidMark size={22} />
              <span style={{ fontSize: 16, fontWeight: 600, color: "#6C4CF7", letterSpacing: "-0.01em" }}>TxID</span>
            </div>
            <span style={{ width: 1, height: 18, background: "#DCE0EC" }} />
            <TeamFinanceLogo height={19} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <a href="#how" className="tf-nav" style={{ fontSize: 14.5, color: "#33374D" }}>How it works</a>
            <a href="#what" className="tf-nav" style={{ fontSize: 14.5, color: "#33374D" }}>What it does</a>
            <a href="#pricing" className="tf-nav" style={{ fontSize: 14.5, color: "#33374D" }}>Pricing</a>
            <a href="#cta" className="tf-btn" style={{ background: BLUE, color: "#fff", fontSize: 14.5, fontWeight: 600, padding: "10px 18px", borderRadius: 8 }}>Get onboarded</a>
          </div>
        </div>
      </header>

      {/* Hero — clean white, floating product shot, Team Finance style */}
      <section style={{ padding: "clamp(56px,7vw,96px) 24px clamp(48px,6vw,80px)" }}>
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
              <a href="#cta" className="tf-btn" style={{ background: BLUE, color: "#fff", fontSize: 15, fontWeight: 600, padding: "14px 24px", borderRadius: 8 }}>Get TxID for your project</a>
              <a href="#what" className="tf-btn-outline" style={{ border: "1px solid #DCE0EC", color: INK, fontSize: 15, fontWeight: 600, padding: "14px 24px", borderRadius: 8 }}>See it in action</a>
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: "#6C7085" }}>Special rates for Team Finance Pro customers.</p>
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

      {/* Stats band (attributed to Team Finance) */}
      <section style={{ padding: "0 24px" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", background: "#F4F7FD", borderRadius: 16, padding: "clamp(28px,3vw,36px)" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK, textAlign: "center", marginBottom: 4 }}>Team Finance in numbers</div>
          <div style={{ fontSize: 13, color: "#6C7085", textAlign: "center", marginBottom: 24 }}>The audited platform your token is already secured on</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 28, justifyItems: "center" }}>
            {[
              { icon: (<><rect x="4" y="10" width="16" height="11" rx="3" fill={BLUE} /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></>), value: "40,000+", label: "Projects" },
              { icon: (<><circle cx="12" cy="12" r="8.5" stroke={BLUE} strokeWidth="1.8" /><path d="M9.5 9.5h5M12 9.5V16" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></>), value: "$498M", label: "Total value locked" },
              { icon: (<><rect x="3.5" y="3.5" width="7" height="7" rx="2" fill={BLUE} /><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="#9DBAF3" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="#9DBAF3" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill={BLUE} /></>), value: "28+", label: "Blockchains supported" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">{s.icon}</svg>
                <div>
                  <div style={{ fontSize: "clamp(20px,2vw,25px)", fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "#6C7085" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Statement */}
      <section style={{ padding: "clamp(64px,8vw,110px) 24px clamp(24px,3vw,40px)" }}>
        <Reveal style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
            Don&apos;t just answer the question. <span style={{ color: BLUE }}>Investigate what happened.</span>
          </h2>
          <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>
            Most support bots search your docs and guess. TxID reads the actual transaction, checks live contract state
            and uses your documentation to explain why something happened, and what the holder should do next.
          </p>
        </Reveal>
      </section>

      {/* What it does — alternating copy / live-product rows */}
      <section id="what" style={{ padding: "clamp(24px,3vw,40px) 24px 0" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gap: "clamp(64px,8vw,110px)" }}>

          {/* Row 1: the live widget answering a failed swap */}
          <Reveal>
            <div className="tf-row">
              <div className="tf-row-copy">
                <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE, marginBottom: 12 }}>A transaction failed?</div>
                <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
                  TxID investigates why, right in your widget.
                </h2>
                <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.7, color: BODY }}>
                  A holder asks what went wrong. TxID reads the transaction, identifies the failure and explains it in
                  plain English, with the next step to take, without them ever leaving your site.
                </p>
                <BlueLink href="#cta">Add TxID to your project</BlueLink>
              </div>
              <div className="tf-row-media"><ProductShot maxWidth={400}><WidgetMockup className="relative" /></ProductShot></div>
            </div>
          </Reveal>

          {/* Row 2: evidence behind every answer (diagnose call) */}
          <Reveal>
            <div className="tf-row reverse">
              <div className="tf-row-copy">
                <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE, marginBottom: 12 }}>Evidence-backed</div>
                <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
                  Every answer carries the evidence behind it.
                </h2>
                <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.7, color: BODY }}>
                  TxID replays the transaction against live chain state, decodes exactly what happened, and shows the
                  sources behind its answer, so a holder can check it instead of taking a bot&apos;s word for it.
                </p>
                <BlueLink href="#cta">See how it investigates</BlueLink>
              </div>
              <div className="tf-row-media"><ProductShot maxWidth={430}><ApiCallMockup className="relative" /></ProductShot></div>
            </div>
          </Reveal>

          {/* Row 3: read-only, on the record */}
          <Reveal>
            <div className="tf-row">
              <div className="tf-row-copy">
                <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE, marginBottom: 12 }}>Safe by design</div>
                <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
                  Read-only, and on the record.
                </h2>
                <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.7, color: BODY }}>
                  TxID never holds keys, funds, or the ability to move anything. It keeps a reviewable record of every
                  conversation, so support is something your compliance team can stand behind, not a black box.
                </p>
                <BlueLink href="#cta">Talk to us</BlueLink>
              </div>
              <div className="tf-row-media"><ProductShot maxWidth={380}><TrustMockup className="relative" /></ProductShot></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Who it's for — Team Finance style 3-audience cards */}
      <section style={{ padding: "clamp(64px,8vw,110px) 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 640, margin: "0 auto 44px", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              One agent, three teams it takes work off
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>
              Team Finance secures the fundamentals. TxID supports the people interacting with them.
            </p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 20 }}>
            {[
              { t: "For your holders", d: "A straight answer the moment a transaction fails or a claim is confusing, 24/7, in your branding, without leaving your site.", icon: (<><circle cx="12" cy="8" r="3.4" stroke={BLUE} strokeWidth="1.8" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></>) },
              { t: "For your support team", d: "The routine on-chain questions answer themselves, so your team only sees the conversations that actually need a human.", icon: (<><path d="M4 5.5h16v10H8l-4 3.5z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.5 9h7M8.5 12h4" stroke={BLUE} strokeWidth="1.6" strokeLinecap="round" /></>) },
              { t: "For your compliance team", d: "Every answer records the transaction, contract state and sources it rested on, as a reviewable trail you can export.", icon: (<><path d="M12 3l7 2.8v5.4c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V5.8L12 3Z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12l2.3 2.3L15.4 10" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>) },
            ].map((c) => (
              <div key={c.t} className="tf-card" style={{ height: "100%", background: "#F7F8FC", borderRadius: 14, padding: 30 }}>
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 12, background: BLUE_TINT, marginBottom: 18 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">{c.icon}</svg>
                </div>
                <h3 style={{ margin: "0 0 9px", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{c.t}</h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: BODY }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust two-column */}
      <section id="trust" style={{ padding: "0 24px clamp(64px,8vw,110px)" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: "clamp(36px,5vw,64px)", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Trust doesn&apos;t stop at launch.
            </h2>
            <p style={{ margin: "18px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.7, color: BODY }}>
              Creating, vesting, locking and managing your tokens with Team Finance&apos;s audited tools shows your
              community the fundamentals are secure. But trust is also built in the everyday moments: when a transaction
              fails, a claim is rejected, or a holder isn&apos;t sure where their funds went.
            </p>
            <p style={{ margin: "14px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.7, color: INK, fontWeight: 500 }}>
              TxID investigates those questions directly from your contracts and live chain state, giving holders a clear
              answer with the evidence behind it.
            </p>
            <p style={{ margin: "20px 0 0", paddingLeft: 15, borderLeft: `3px solid ${BLUE}`, fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.6, color: INK }}>
              Team Finance helps you secure the infrastructure. TxID helps you support the people using it.
            </p>
          </div>
          <div style={{ background: "#F7F8FC", borderRadius: 16, padding: "clamp(24px,2.4vw,32px)", minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, marginBottom: 10 }}>What your holders ask</div>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.65, color: "#5A6076" }}>
              These aren&apos;t questions your team should have to investigate by hand. TxID answers them automatically,
              with evidence your holders can check.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {["Why did my swap fail?", "When can I claim my vested tokens?", "Is my transaction stuck, or did it go through?", "Why was my claim rejected?", "Is the liquidity actually locked?"].map((q) => (
                <div key={q} style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", border: "1px solid #EDEFF6", borderRadius: 10, padding: "13px 15px", fontSize: 14, color: INK }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: BLUE, flex: "none" }} />
                  {q}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* How it works — 3 steps */}
      <section id="how" style={{ background: "#F7F8FC", borderTop: "1px solid #EDEFF6", borderBottom: "1px solid #EDEFF6", padding: "clamp(64px,8vw,110px) 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 620, margin: "0 auto 44px", textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE, marginBottom: 10 }}>How it works</div>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600 }}>New to TxID? Live in three steps.</h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>Hands-on onboarding, with your project live quickly.</p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 20 }}>
            {[
              { n: "01", t: "Tell us about your project", d: "Contact us and share your token, contracts and where your holders interact with you." },
              { n: "02", t: "We connect TxID", d: "We point it at your Team Finance locks and vesting, your contracts and your docs, and set your branding." },
              { n: "03", t: "Go live", d: "Add one line to your website and give your holders 24/7, evidence-backed on-chain support." },
            ].map((s) => (
              <div key={s.n} className="tf-card" style={{ height: "100%", background: "#fff", border: "1px solid #EDEFF6", borderRadius: 14, padding: 28 }}>
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: BLUE_TINT, color: BLUE, fontSize: 15, fontWeight: 700, marginBottom: 18 }}>{s.n}</div>
                <h3 style={{ margin: "0 0 8px", fontSize: 17.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{s.t}</h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: BODY }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "clamp(64px,8vw,110px) 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 640, margin: "0 auto 40px", textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE, marginBottom: 10 }}>Pricing</div>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.8vw,32px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Priced per resolution, not per seat.
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(15px,1.1vw,16.5px)", lineHeight: 1.65, color: BODY }}>
              Human support tools like Intercom and Zendesk bill per seat, and still need a person for on-chain
              questions. TxID resolves those automatically, so you pay for answers your holders actually got, not for
              headcount.
            </p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 20, maxWidth: 760, margin: "0 auto" }}>
            <div className="tf-card" style={{ height: "100%", background: "#F7F8FC", borderRadius: 14, padding: 30 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: INK, marginBottom: 8, letterSpacing: "-0.01em" }}>Pay for resolutions</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: BODY }}>
                You are billed for the conversations TxID actually resolves, not for seats sitting idle or tickets that
                never needed a human.
              </p>
            </div>
            <div style={{ height: "100%", background: BLUE, borderRadius: 14, padding: 30, color: "#fff" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>Special rates for Team Finance Pro</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "rgba(255,255,255,0.9)" }}>
                Team Finance Pro projects get preferential pricing. Talk to us and we will size it to your holder base.
              </p>
            </div>
          </div>
          <Reveal style={{ textAlign: "center", marginTop: 28 }}>
            <a href={ONBOARD} className="tf-btn" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: BLUE, color: "#fff", fontSize: 15, fontWeight: 600, padding: "14px 26px", borderRadius: 8 }}>
              Talk to us about pricing <span aria-hidden="true">&rarr;</span>
            </a>
          </Reveal>
        </div>
      </section>

      {/* About the partners */}
      <section style={{ padding: "0 24px clamp(64px,8vw,110px)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ marginBottom: 32, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(22px,2.5vw,28px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600 }}>About the partners</h2>
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

      {/* Final CTA — flat blue band, Team Finance style */}
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
            Get TxID for your project <span aria-hidden="true">&rarr;</span>
          </a>
          <p style={{ margin: "18px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Special rates for Team Finance Pro customers.</p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
            <span>Custom branded</span>
            <span>Live in minutes</span>
            <span>Read-only, evidence-backed</span>
          </div>
        </Reveal>
      </section>

      {/* Footer — richer multi-column, Team Finance style */}
      <footer style={{ borderTop: "1px solid #EDEFF6", padding: "clamp(40px,5vw,56px) 24px 32px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 32 }}>
          <div style={{ maxWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TxidMark size={20} />
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "#6C4CF7" }}>TxID</span>
              </div>
              <span style={{ width: 1, height: 15, background: "#DCE0EC" }} />
              <TeamFinanceLogo height={16} />
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#6C7085" }}>
              Evidence-backed on-chain support for Team Finance projects.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 12 }}>Product</div>
            <div style={{ display: "grid", gap: 9, fontSize: 13.5 }}>
              <a href="#what" className="tf-foot" style={{ color: "#6C7085" }}>What it does</a>
              <a href="#how" className="tf-foot" style={{ color: "#6C7085" }}>How it works</a>
              <a href="#pricing" className="tf-foot" style={{ color: "#6C7085" }}>Pricing</a>
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
