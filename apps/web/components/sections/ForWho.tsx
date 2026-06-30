import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { APP_URL } from "@/lib/config";

const PROJECT_TYPES = [
  {
    label: "DEX / AMM",
    description: "Diagnose failed swaps and wrong-network errors in real time.",
  },
  {
    label: "Lending protocol",
    description: "Wallet-aware support for liquidations, positions, and collateral questions.",
  },
  {
    label: "Token launch",
    description: "Answer where to buy, how to stake, and what the tokenomics look like.",
  },
  {
    label: "DAO / Community",
    description: "Onboard new members with docs Q&A and community link directories.",
  },
  {
    label: "NFT project",
    description: "Guide collectors through minting, traits, and secondary market links.",
  },
  {
    label: "Chain / L2",
    description: "Support bridging questions, gas explanations, and ecosystem navigation.",
  },
];

export function ForWho() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="font-mono text-sm text-accent mb-3">{"// Who it's for"}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Built for any crypto project
            </h2>
            <p className="text-muted max-w-lg mx-auto">
              One agent, configured to your project. Whether you need on-chain diagnostics,
              community onboarding, or both.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="grid sm:grid-cols-2 gap-x-16 gap-y-5 mb-10">
            {PROJECT_TYPES.map((type) => (
              <div key={type.label} className="flex items-start gap-3">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{type.label}</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="flex justify-center">
            <Button href={`${APP_URL}/sign-up`} variant="primary">
              Get started free
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
