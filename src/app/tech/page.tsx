import type { Metadata } from "next";
import TechLandingClient from "@/components/landing/TechLandingClient";

export const metadata: Metadata = {
  title: "Aletheia for Tech & AI | Raw Signal, Zero PR Hype",
  description:
    "Engineered for software engineers, ML researchers, and builders. Strips PR spin, marketing hyperbole, and benchmark cherry-picking into verified architecture and reproducible facts.",
  openGraph: {
    title: "Aletheia for Tech & AI | Raw Signal, Zero PR Hype",
    description:
      "Engineered for developers and AI researchers. Verified technical intelligence, ArXiv grounding, and zero promotional noise.",
    images: [
      {
        url: "/images/landing/personas/tech-hero.jpg",
        width: 1280,
        height: 720,
        alt: "Aletheia Tech Edition — Verified intelligence for builders",
      },
    ],
  },
};

export default function TechPage() {
  return <TechLandingClient />;
}
