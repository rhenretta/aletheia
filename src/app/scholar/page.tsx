import type { Metadata } from "next";
import ScholarLandingClient from "@/components/landing/ScholarLandingClient";

export const metadata: Metadata = {
  title: "Aletheia for Scholars & Academics | Epistemic Rigor & Primary Sources",
  description:
    "Tailored for historians, researchers, educators, and epistemic fact purists. Multi-wire provenance trees, Hegelian dialectic synthesis, and chronological story memory.",
  openGraph: {
    title: "Aletheia for Scholars & Academics | Epistemic Rigor & Primary Sources",
    description:
      "Primary source provenance and dialectic synthesis over outrage. Verify claims directly to global wires with persistent chronological memory.",
    images: [
      {
        url: "/images/landing/personas/scholar-hero.jpg",
        width: 1280,
        height: 720,
        alt: "Aletheia Scholar Edition — Epistemic rigor and archival provenance",
      },
    ],
  },
};

export default function ScholarPage() {
  return <ScholarLandingClient />;
}
