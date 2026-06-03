import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { getServerMinimalWagmiConfig } from "@/lib/blockchain/minimal-wagmi-config";
import { landingFontClassName } from "@/lib/fonts/landing-fonts";
import { rootSiteMetadata } from "@/lib/seo/metadata";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import "./globals.css";

const RootClientBody = dynamic(() => import("@/components/layout/RootClientBody"), {
  ssr: true,
  loading: () => (
    <div className="flex min-h-screen flex-col bg-black">
      <div className="h-14 border-b border-brand-green/20 bg-gray-900/40" aria-hidden />
      <div className="flex flex-1 items-center justify-center">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-800" aria-label="Loading" />
      </div>
    </div>
  ),
});

export const metadata: Metadata = rootSiteMetadata();

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#58b12f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let wagmiInitialState: ReturnType<typeof cookieToInitialState> | undefined;
  if (process.env.NEXT_PUBLIC_AA_AUTH_ENABLED === "true") {
    try {
      wagmiInitialState = cookieToInitialState(
        getServerMinimalWagmiConfig(),
        (await headers()).get("cookie")
      );
    } catch (err) {
      console.error("[layout] wagmi cookie hydration failed:", err);
      wagmiInitialState = undefined;
    }
  }

  return (
    <html lang="en" className={`dark ${landingFontClassName}`}>
      <body className="antialiased flex flex-col min-h-screen bg-black">
        <SiteJsonLd />
        <RootClientBody wagmiInitialState={wagmiInitialState}>{children}</RootClientBody>
      </body>
    </html>
  );
}
