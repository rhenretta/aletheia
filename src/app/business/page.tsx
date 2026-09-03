import type { Metadata } from "next";
import BusinessLandingClient from "@/components/landing/BusinessLandingClient";

export const metadata: Metadata = {
  title: "Aletheia for Executives & Investors | Strategic Alpha Without Noise",
  description:
    "Tailored for founders, directors, and capital allocators. 90-second executive dossiers, macroeconomic consequence modeling, and zero emotional spin.",
  openGraph: {
    title: "Aletheia for Executives & Investors | Strategic Alpha Without Noise",
    description:
      "Reclaim 250+ executive hours per year. High-density briefings and market impact matrices stripped of clickbait.",
    images: [
      {
        url: "/images/landing/personas/business-hero.jpg",
        width: 1280,
        height: 720,
        alt: "Aletheia Executive Edition — Strategic intelligence for decision makers",
      },
    ],
  },
};

export default function BusinessPage() {
  return <BusinessLandingClient />;
}
