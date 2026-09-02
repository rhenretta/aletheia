import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")
    ? process.env.NEXTAUTH_URL
    : "https://news.ciclops.io");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Aletheia | News Without Noise",
  description: "News without the noise. Clear facts without the drama. An AI reading partner that filters out clickbait and sensationalism so you get the real story.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Aletheia | News Without Noise",
    description: "News without the noise. Clear facts without the drama. An AI reading partner that filters out clickbait and sensationalism so you get the real story.",
    url: siteUrl,
    siteName: "Aletheia",
    images: [
      {
        url: `${siteUrl}/og-image.jpg`,
        secureUrl: `${siteUrl}/og-image.jpg`,
        width: 1280,
        height: 720,
        type: "image/jpeg",
        alt: "Aletheia — News without the noise. Clear facts without the drama.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aletheia | News Without Noise",
    description: "News without the noise. Clear facts without the drama. An AI reading partner that filters out clickbait and sensationalism.",
    images: [`${siteUrl}/og-image.jpg`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-black">
        <GoogleAnalytics />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
