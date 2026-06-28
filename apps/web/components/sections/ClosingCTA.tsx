import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { APP_URL } from "@/lib/config";

export function ClosingCTA() {
  return (
    <section className="py-20 border-t border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <FadeIn>
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Ready to stop answering the same questions?
          </h2>
          <p className="text-muted mb-8 max-w-xl mx-auto">
            Set up in under five minutes. Free to start, no credit card required.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button href={`${APP_URL}/sign-up`} variant="primary" size="lg">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button href="mailto:hello@txid.support" variant="outline" size="lg">
              Talk to us
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
