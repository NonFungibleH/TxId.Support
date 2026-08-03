import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";

export function ClosingCTA() {
  return (
    <section className="py-14 border-t border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <FadeIn>
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Ready to transform on-chain support?
          </h2>
          <p className="text-muted mb-8 max-w-xl mx-auto">
            See how TxID works with your protocol, or request early access.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button href="/check" variant="primary" size="lg">
              Try it live
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button href="mailto:team@txid.support" variant="outline" size="lg">
              Email us
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
