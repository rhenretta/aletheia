import type { Metadata } from "next";
import WellnessLandingClient from "@/components/landing/WellnessLandingClient";

export const metadata: Metadata = {
  title: "Aletheia for Mindful Reading | News Without the Anxiety",
  description:
    "A peaceful news sanctuary for your mind. Designed for digital wellness, doomscroll recovery, and nervous system regulation with calm factual reporting.",
  openGraph: {
    title: "Aletheia for Mindful Reading | News Without the Anxiety",
    description:
      "Break free from algorithmic outrage loops. Stay informed with calm, finite, verified facts that protect your mental peace.",
    images: [
      {
        url: "/images/landing/personas/wellness-hero.jpg",
        width: 1280,
        height: 720,
        alt: "Aletheia for Mindful Readers — Mindful news without the anxiety",
      },
    ],
  },
};

export default function WellnessPage() {
  return <WellnessLandingClient />;
}
