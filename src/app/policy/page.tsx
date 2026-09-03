import type { Metadata } from "next";
import PolicyLandingClient from "@/components/landing/PolicyLandingClient";

export const metadata: Metadata = {
  title: "Aletheia for Watchdogs & Policy | Independent Verification & Bias Audit",
  description:
    "Tailored for investigative journalists, policy fellows, and civic observers. Cross-spectrum wire discrepancy detection, chronological timeline tracking, and uncompromised verification.",
  openGraph: {
    title: "Aletheia for Watchdogs & Policy | Independent Verification & Bias Audit",
    description:
      "Follow the story, not the spin. Auditing global wires in real-time to isolate contradicted claims and uncover omitted context.",
    images: [
      {
        url: "/images/landing/personas/policy-hero.jpg",
        width: 1280,
        height: 720,
        alt: "Aletheia for Watchdogs & Policy — Independent verification and discrepancy tracking",
      },
    ],
  },
};

export default function PolicyPage() {
  return <PolicyLandingClient />;
}
