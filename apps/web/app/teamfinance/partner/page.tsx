import type { Metadata } from "next";
import { PartnerPortal } from "./PartnerPortal";

export const metadata: Metadata = {
  title: "Team Finance Partner Portal · TxID",
  description:
    "Referral partner portal: see your referred clients, their usage, commission earned and payout status.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PartnerPortal />;
}
