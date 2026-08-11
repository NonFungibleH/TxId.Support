import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { InvestigationMockup } from "@/components/sections/InvestigationMockup";
import { Reveal } from "./Reveal";

/**
 * TxID × Team Finance partnership landing page.
 *
 * The visitor arrives cold from team.finance and has never heard of TxID, so
 * this page has to explain the product properly, the way the homepage does, not
 * just badge it. It reuses the homepage's animated investigation graphic and
 * mirrors its How-it-works and compliance messaging, all restyled into Team
 * Finance's own light world so it reads as a Team Finance page with TxID as the
 * product offered inside it.
 *
 * BRANDING: uses Team Finance's OFFICIAL assets from their brand kit, their blue
 * logotype SVG (public/brand/teamfinance-logotype.svg) and their real brand blue
 * (a #1D65DC → #0A4BB3 gradient, taken from the logotype itself). TxID's own
 * dark/violet identity appears only inside the investigation graphic, which is
 * the product shot. The agent is CUSTOM BRANDED to each project's platform,
 * never "co-branded", never "Team Finance branded": say custom branded, your
 * branding.
 *
 * NOINDEX: this is a pitch page shown to Team Finance directly, not a public
 * marketing page, so it is kept out of the index and the sitemap. It is meant to
 * be shared by link (a Vercel preview), not discovered.
 */

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const ONBOARD =
  "mailto:team@txid.support?subject=TxID%20%C3%97%20Team%20Finance%20onboarding&body=Hi%20TxID%20team%2C%20we%20came%20from%20Team%20Finance%20and%20would%20like%20to%20add%20the%20support%20agent%20to%20our%20token.";

// Team Finance's real brand blue, from their logotype gradient.
const BLUE = "#1D65DC";
const BLUE_DEEP = "#0A4BB3";
const GRAD = "linear-gradient(135deg,#1D65DC 0%,#0A4BB3 100%)";

export const metadata: Metadata = {
  title: "TxID × Team Finance: on-chain support that investigates what happened",
  description:
    "Add a custom-branded TxID support agent to your Team Finance project. It investigates failed transactions, reads your contracts and docs, and gives holders evidence-backed answers 24/7.",
  // Pitch page, shared by link. Keep it out of search and the sitemap. No
  // canonical: pairing rel=canonical with noindex is a mixed signal, and a
  // link-only page has nothing to canonicalise.
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

export default function TeamFinancePage() {
  return (
    <div
      className={`tf ${poppins.variable}`}
      style={{ position: "relative", zIndex: 10, background: "#fff", color: "#101223", fontFamily: "var(--font-poppins), system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
.tf { scroll-behavior: smooth; }
.tf a { text-decoration: none; }
.tf [id] { scroll-margin-top: 80px; }
.tf .tf-btn-blue, .tf .tf-btn-grad, .tf .tf-btn-outline, .tf .tf-btn-white,
.tf .tf-link, .tf .tf-link-violet, .tf .tf-nav, .tf .tf-foot, .tf .tf-card {
  transition: background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.tf .tf-btn-blue:hover { background: ${BLUE_DEEP} !important; }
.tf .tf-btn-grad:hover { filter: brightness(1.06); }
.tf .tf-btn-outline:hover { border-color: ${BLUE} !important; color: ${BLUE} !important; }
.tf .tf-btn-white:hover { background: #EAF0FD !important; color: ${BLUE_DEEP} !important; }
.tf .tf-link:hover, .tf .tf-nav:hover { color: ${BLUE_DEEP} !important; }
.tf .tf-link-violet:hover { color: #4B2FE0 !important; }
.tf .tf-foot:hover { color: #101223 !important; }
.tf .tf-nav { padding: 6px 0; }
.tf a:focus-visible { outline: 2px solid ${BLUE}; outline-offset: 3px; border-radius: 4px; }
.tf .tf-card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -24px rgba(16,18,35,0.28); }
@media (prefers-reduced-motion: reduce) { .tf .tf-card:hover { transform: none; } .tf .tf-float { animation: none; } }
.tf .tf-grid-bg {
  background-image:
    linear-gradient(${BLUE}0f 1px, transparent 1px),
    linear-gradient(90deg, ${BLUE}0f 1px, transparent 1px);
  background-size: 46px 46px;
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 65% 30%, #000 0%, transparent 72%);
  mask-image: radial-gradient(ellipse 80% 70% at 65% 30%, #000 0%, transparent 72%);
}
@keyframes tfFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.tf .tf-float { animation: tfFloat 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .tf .tf-float { animation: none; } }
`,
        }}
      />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.85)", backdropFilter: "saturate(180%) blur(12px)", WebkitBackdropFilter: "saturate(180%) blur(12px)", borderBottom: "1px solid #EDEFF6" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <TxidMark size={22} />
              <span style={{ fontSize: 15.5, fontWeight: 600, color: "#6C4CF7", letterSpacing: "-0.01em" }}>TxID</span>
            </div>
            <span style={{ width: 1, height: 18, background: "#DCE0EC" }} />
            <TeamFinanceLogo height={19} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <a href="#how" className="tf-nav" style={{ fontSize: 14, color: "#33374D" }}>How it works</a>
            <a href="#what" className="tf-nav" style={{ fontSize: 14, color: "#33374D" }}>What it does</a>
            <a href="#pricing" className="tf-nav" style={{ fontSize: 14, color: "#33374D" }}>Pricing</a>
            <a href="#cta" className="tf-btn-grad" style={{ background: GRAD, color: "#fff", fontSize: 14, fontWeight: 500, padding: "10px 18px", borderRadius: 8 }}>Get onboarded</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(48px,6vw,84px) 24px clamp(40px,5vw,64px)" }}>
        <div aria-hidden="true" className="tf-grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: "-10%", right: "-6%", width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle at center, rgba(29,101,220,0.16) 0%, transparent 68%)", pointerEvents: "none" }} />
        <Reveal style={{ position: "relative", maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: "clamp(32px,5vw,56px)", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(30px,3.9vw,46px)", lineHeight: 1.15, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              You secured your token.{" "}
              <span style={{ color: BLUE }}>Now give your holders answers they can trust.</span>
            </h1>
            <p style={{ margin: "20px 0 0", fontSize: "clamp(14.5px,1.15vw,16px)", lineHeight: 1.65, color: "#4B5063", maxWidth: 510, textWrap: "pretty" }}>
              Add a custom-branded TxID support agent to your platform. It investigates transactions, reads your
              contracts and docs, and gives holders clear, evidence-backed answers 24/7, in your branding.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
              <a href="#cta" className="tf-btn-grad" style={{ background: GRAD, color: "#fff", fontSize: 15, fontWeight: 500, padding: "15px 24px", borderRadius: 8 }}>Get TxID for your project</a>
              <a href="#how" className="tf-btn-outline" style={{ border: "1px solid #DCE0EC", color: "#101223", fontSize: 15, fontWeight: 500, padding: "15px 24px", borderRadius: 8 }}>See how it works</a>
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: "#6C7085" }}>Special rates for Team Finance Pro customers.</p>
          </div>
          <div className="tf-float" style={{ minWidth: 0, display: "flex", justifyContent: "center", position: "relative" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: "6% 4%", borderRadius: 24, background: "rgba(29,101,220,0.20)", filter: "blur(46px)" }} />
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
          </div>
        </Reveal>
      </section>

      {/* Investigation statement */}
      <section style={{ padding: "0 24px clamp(40px,5vw,64px)" }}>
        <Reveal style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,2.6vw,30px)", lineHeight: 1.25, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
            Don&apos;t just answer the question. Investigate what happened.
          </h2>
          <p style={{ margin: "14px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.65, color: "#4B5063", textWrap: "pretty" }}>
            Most support bots search your docs and guess. TxID reads the actual transaction, checks live contract state
            and uses your documentation to explain why something happened, and what the holder should do next.
          </p>
        </Reveal>
      </section>

      {/* Stats band */}
      <section style={{ padding: "0 24px" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", background: "#F1F5FC", borderRadius: 14, padding: "clamp(26px,3vw,34px)" }}>
          {/* Attributed to Team Finance: these are their numbers, not TxID's, and
              an unlabeled band right after the TxID intro would read as TxID's. */}
          <div style={{ fontSize: 15, fontWeight: 600, color: "#101223", textAlign: "center", marginBottom: 4 }}>Team Finance in numbers</div>
          <div style={{ fontSize: 12.5, color: "#6C7085", textAlign: "center", marginBottom: 22 }}>The audited platform your token is already secured on</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 28, justifyItems: "center" }}>
            {[
              { icon: (<><rect x="4" y="10" width="16" height="11" rx="3" fill={BLUE} /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></>), value: "40,000+", label: "Projects" },
              { icon: (<><circle cx="12" cy="12" r="8.5" stroke={BLUE} strokeWidth="1.8" /><path d="M9.5 9.5h5M12 9.5V16" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></>), value: "$498M", label: "Total value locked" },
              { icon: (<><rect x="3.5" y="3.5" width="7" height="7" rx="2" fill={BLUE} /><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="#9DB8F4" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="#9DB8F4" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill={BLUE} /></>), value: "28+", label: "Blockchains supported" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">{s.icon}</svg>
                <div>
                  <div style={{ fontSize: "clamp(20px,2vw,25px)", fontWeight: 600, letterSpacing: "-0.02em", color: "#101223" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "#6C7085" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: "clamp(60px,7vw,96px) 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 620, margin: "0 auto 44px", textAlign: "center" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE }}>How TxID works</p>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              New to TxID? Here is what it actually does.
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.65, color: "#4B5063", textWrap: "pretty" }}>
              TxID is an on-chain support agent. It learns your project, investigates what happened on the blockchain,
              and answers your holders with the evidence behind it.
            </p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
            {[
              { n: "01", t: "It learns your project", d: "TxID reads your Team Finance locks and vesting, your smart contracts and your documentation, so it answers from your project, not generic blockchain knowledge." },
              { n: "02", t: "It investigates on-chain", d: "When a holder asks, TxID reads the live transaction and contract state, replays a failed transaction and decodes exactly what went wrong." },
              { n: "03", t: "It answers with evidence", d: "The holder gets a clear answer and the next step to take, with the sources behind it, 24/7, inside your own branding." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="tf-card" style={{ height: "100%", background: "#fff", border: "1px solid #EDEFF6", borderRadius: 14, padding: 28 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 11, background: "#EAF0FD", color: BLUE, fontWeight: 700, fontSize: 15, marginBottom: 18 }}>{s.n}</div>
                  <h3 style={{ margin: "0 0 9px", fontSize: 17.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{s.t}</h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "#4B5063" }}>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What it does */}
      <section id="what" style={{ padding: "0 24px clamp(60px,7vw,96px)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 640, margin: "0 auto 44px", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              A support agent that knows your token, smart contracts and docs
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.65, color: "#4B5063", textWrap: "pretty" }}>
              Not a generic chatbot. It investigates your on-chain activity using your contracts, live chain state and
              documentation, so holders get answers based on what is actually happening, not a guess.
            </p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
            {[
              { title: "A transaction failed? TxID investigates why.", body: "It reads the transaction, identifies the failure and explains it in plain English, with the next step the holder should take.", icon: (<><circle cx="10.5" cy="10.5" r="6.5" stroke={BLUE} strokeWidth="1.8" /><path d="M15.5 15.5 20 20" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" /></>) },
              { title: "Answers from your actual project data.", body: "From vesting schedules and claim windows to lock and unlock dates, TxID answers from your contracts and documentation, not generic blockchain knowledge.", icon: (<><rect x="5" y="3" width="14" height="18" rx="2.5" stroke={BLUE} strokeWidth="1.8" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke={BLUE} strokeWidth="1.6" strokeLinecap="round" /></>) },
              { title: "Every answer comes with evidence.", body: "TxID checks live chain state and shows the sources behind its answer, so holders can verify what they are told instead of taking a bot's word for it.", icon: (<><path d="M12 3l7 2.8v5.4c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V5.8L12 3Z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12l2.3 2.3L15.4 10" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>) },
              { title: "One line to embed. Your branding throughout.", body: "Add TxID to your website with a single snippet. Apply your colours and logo so holders get support without ever leaving your product.", icon: <path d="M8.5 7 4 12l4.5 5M15.5 7 20 12l-4.5 5" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 0.06}>
                <div className="tf-card" style={{ height: "100%", background: "#F7F8FC", borderRadius: 14, padding: 28 }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginBottom: 18 }}>{card.icon}</svg>
                  <h3 style={{ margin: "0 0 9px", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{card.title}</h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "#4B5063" }}>{card.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" style={{ padding: "0 24px clamp(60px,7vw,96px)" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: "clamp(32px,5vw,56px)", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Trust doesn&apos;t stop at launch.
            </h2>
            <p style={{ margin: "18px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.7, color: "#4B5063", textWrap: "pretty" }}>
              Creating, vesting, locking and managing your tokens with Team Finance&apos;s audited tools shows your
              community the fundamentals are secure. But trust is also built in the everyday moments: when a transaction
              fails, a claim is rejected, or a holder isn&apos;t sure where their funds went.
            </p>
            <p style={{ margin: "14px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.7, color: "#101223", fontWeight: 500, textWrap: "pretty" }}>
              TxID investigates those questions directly from your contracts and live chain state, giving holders a clear
              answer with the evidence behind it.
            </p>
            <p style={{ margin: "18px 0 0", paddingLeft: 14, borderLeft: `3px solid ${BLUE}`, fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.6, color: "#101223", textWrap: "pretty" }}>
              Team Finance helps you secure the infrastructure. TxID helps you support the people using it.
            </p>
            <a href="#cta" className="tf-link" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 22, fontSize: 14.5, fontWeight: 500, color: BLUE }}>
              Add TxID to your project <span>&rsaquo;</span>
            </a>
          </div>
          <div style={{ background: "#F7F8FC", borderRadius: 14, padding: "clamp(22px,2.4vw,30px)", minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#101223", marginBottom: 10 }}>What your holders ask</div>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.65, color: "#5A6076" }}>
              These aren&apos;t questions your team should have to investigate by hand. TxID reads the relevant contracts,
              transactions, documentation and live chain state to answer them automatically.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {["Why did my swap fail?", "When can I claim my vested tokens?", "Is my transaction stuck, or did it go through?", "Why was my claim rejected?", "Is the liquidity actually locked?"].map((q) => (
                <div key={q} style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", border: "1px solid #EDEFF6", borderRadius: 9, padding: "13px 15px", fontSize: 14, color: "#101223" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: BLUE, flex: "none" }} />
                  {q}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Compliance strip */}
      <section style={{ padding: "0 24px clamp(60px,7vw,96px)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 620, margin: "0 auto 40px", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Built for teams that need a record.
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.65, color: "#4B5063", textWrap: "pretty" }}>
              TxID is read-only and keeps a reviewable record of every conversation, so support is something your
              compliance team can stand behind, not a black box.
            </p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
            {[
              { t: "Read-only, never custodial", d: "TxID reads chain state and your docs. It never holds funds or keys, and can never move anything." },
              { t: "Evidence behind every answer", d: "Each answer records the transaction, contract state and sources it rested on, so it can be reviewed later." },
              { t: "Every conversation on file", d: "A reviewable record of what was asked, what was answered, and the chain state at that moment." },
              { t: "No financial advice", d: "It explains what happened and what to do next. It never tells a holder to buy, sell or hold." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 0.06}>
                <div className="tf-card" style={{ height: "100%", background: "#F7F8FC", borderRadius: 14, padding: 24 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "#EAF0FD", marginBottom: 14 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 2.8v5.4c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V5.8L12 3Z" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12l2.3 2.3L15.4 10" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: "#101223", marginBottom: 8, letterSpacing: "-0.01em" }}>{c.t}</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#4B5063" }}>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* More than a chatbot */}
      <section style={{ padding: "0 24px clamp(60px,7vw,96px)" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", borderRadius: 16, padding: "clamp(36px,4.5vw,60px) clamp(24px,4vw,48px)", background: "#0E1024", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: "-40%", left: "-10%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle at center, rgba(29,101,220,0.4) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, color: "#fff", textWrap: "balance" }}>
              More than a chatbot. An on-chain investigator.
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.7, color: "rgba(255,255,255,0.72)", textWrap: "pretty" }}>
              Most support bots can search documentation and generate an answer.{" "}
              <span style={{ color: "#fff", fontWeight: 500 }}>TxID can investigate what actually happened on-chain</span>, bringing together transaction data,
              smart contract state, live blockchain data and your documentation to explain what happened and why.
            </p>
            <p style={{ margin: "22px 0 0", fontSize: "clamp(15px,1.2vw,17px)", fontWeight: 500, color: "#8FB3FF" }}>
              The result: an answer your holder can understand, and verify.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Onboarding */}
      <section id="onboarding" style={{ background: "#F7F8FC", borderTop: "1px solid #EDEFF6", borderBottom: "1px solid #EDEFF6", padding: "clamp(60px,7vw,96px) 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 600, margin: "0 auto 40px", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600 }}>Onboarding, start to finish</h2>
            <p style={{ margin: "14px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.65, color: "#4B5063" }}>Hands-on onboarding, with your project live quickly.</p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
            {[
              { n: "1", t: "Tell us about your project", d: "Contact us and share your token, contracts and where your holders interact with you." },
              { n: "2", t: "We connect TxID", d: "We connect TxID to your contracts and documentation and set up your branding." },
              { n: "3", t: "Go live", d: "Add one line to your website and give your holders 24/7, evidence-backed on-chain support." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="tf-card" style={{ height: "100%", background: "#fff", border: "1px solid #EDEFF6", borderRadius: 14, padding: 26 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: GRAD, color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{s.n}</div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{s.t}</h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "#4B5063" }}>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "clamp(60px,7vw,96px) 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ maxWidth: 640, margin: "0 auto 40px", textAlign: "center" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: BLUE }}>Pricing</p>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Priced per resolution, not per seat.
            </h2>
            <p style={{ margin: "16px 0 0", fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.65, color: "#4B5063", textWrap: "pretty" }}>
              Human support tools like Intercom and Zendesk bill per seat, and still need a person for on-chain
              questions. TxID resolves those questions automatically, so you pay for answers your holders actually got,
              not for headcount.
            </p>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, maxWidth: 760, margin: "0 auto" }}>
            <Reveal>
              <div className="tf-card" style={{ height: "100%", background: "#F7F8FC", borderRadius: 14, padding: 28 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: "#101223", marginBottom: 8, letterSpacing: "-0.01em" }}>Pay for resolutions</div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "#4B5063" }}>
                  You are billed for the conversations TxID actually resolves, not for seats sitting idle or tickets that
                  never needed a human.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div style={{ height: "100%", background: GRAD, borderRadius: 14, padding: 28, color: "#fff" }}>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>Special rates for Team Finance Pro</div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "rgba(255,255,255,0.88)" }}>
                  Team Finance Pro projects get preferential pricing. Talk to us and we will size it to your holder base.
                </p>
              </div>
            </Reveal>
          </div>
          <Reveal style={{ textAlign: "center", marginTop: 28 }}>
            <a href={ONBOARD} className="tf-btn-blue" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: BLUE, color: "#fff", fontSize: 15, fontWeight: 600, padding: "14px 26px", borderRadius: 8 }}>
              Talk to us about pricing <span>&rarr;</span>
            </a>
          </Reveal>
        </div>
      </section>

      {/* About the partners */}
      <section style={{ padding: "0 24px clamp(60px,7vw,96px)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal style={{ marginBottom: 32, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(22px,2.6vw,30px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600 }}>About the partners</h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
            <Reveal>
              <div style={{ height: "100%", background: "#F7F8FC", borderRadius: 14, padding: "clamp(24px,2.6vw,32px)" }}>
                <div style={{ marginBottom: 16 }}><TeamFinanceLogo height={22} /></div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "#4B5063" }}>
                  Team Finance provides audited token and liquidity locks, token launches, and vesting contracts across
                  28+ blockchains. It is where projects lock their liquidity and vest their team tokens to say no to
                  rug-pulls and show their community the fundamentals are secured, trusted by 40,000+ projects.
                </p>
                <a href="https://team.finance" target="_blank" rel="noopener noreferrer" className="tf-link" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, fontSize: 14.5, fontWeight: 500, color: BLUE }}>team.finance <span>&rsaquo;</span></a>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div style={{ height: "100%", background: "#F7F8FC", borderRadius: 14, padding: "clamp(24px,2.6vw,32px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
                  <TxidMark size={22} />
                  <span style={{ fontSize: 16.5, fontWeight: 600, color: "#6C4CF7", letterSpacing: "-0.01em" }}>TxID</span>
                </div>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "#4B5063" }}>
                  TxID is the support layer for on-chain finance. It gives a protocol&apos;s users an AI support agent
                  that reads its contracts, documentation and live chain state, answers with the evidence behind every
                  claim, and keeps a reviewable record of every conversation.
                </p>
                <a href="https://txid.support" className="tf-link-violet" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, fontSize: 14.5, fontWeight: 500, color: "#6C4CF7" }}>txid.support <span>&rsaquo;</span></a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" style={{ padding: "0 24px clamp(60px,7vw,96px)" }}>
        <Reveal style={{ maxWidth: 1160, margin: "0 auto", background: GRAD, borderRadius: 16, padding: "clamp(38px,5vw,60px) clamp(24px,4vw,48px)", textAlign: "center", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "46px 46px", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px,2.9vw,34px)", lineHeight: 1.2, letterSpacing: "-0.02em", fontWeight: 600, textWrap: "balance" }}>
              Give your holders answers they can verify.
            </h2>
            <p style={{ margin: "16px auto 0", maxWidth: 520, fontSize: "clamp(14.5px,1.1vw,16px)", lineHeight: 1.65, color: "rgba(255,255,255,0.85)" }}>
              Add TxID to your Team Finance project and give your community 24/7 support for the on-chain questions that
              normally reach your team.
            </p>
            <a href={ONBOARD} className="tf-btn-white" style={{ display: "inline-flex", alignItems: "center", gap: 9, marginTop: 26, background: "#fff", color: BLUE, fontSize: 15, fontWeight: 600, padding: "15px 26px", borderRadius: 8 }}>
              Get TxID for your project <span>&rarr;</span>
            </a>
            <p style={{ margin: "18px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Special rates for Team Finance Pro customers.</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, marginTop: 14, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              <span>Custom branded</span>
              <span>Live in minutes</span>
              <span>Read-only, evidence-backed</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #EDEFF6", padding: "26px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TxidMark size={20} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#6C4CF7" }}>TxID</span>
            </div>
            <span style={{ width: 1, height: 15, background: "#DCE0EC" }} />
            <TeamFinanceLogo height={16} />
          </div>
          <div style={{ display: "flex", gap: 22, fontSize: 13 }}>
            <a href="https://txid.support" className="tf-foot" style={{ color: "#6C7085" }}>txid.support</a>
            <a href="https://team.finance" target="_blank" rel="noopener noreferrer" className="tf-foot" style={{ color: "#6C7085" }}>team.finance</a>
            <a href="/privacy" className="tf-foot" style={{ color: "#6C7085" }}>Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
