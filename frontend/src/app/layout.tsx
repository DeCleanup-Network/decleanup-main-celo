import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import { Bebas_Neue } from "next/font/google";
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

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

// Same file as geist/font/mono; preload off so Chrome does not warn when monospace is not in first paint.
const geistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  preload: false,
});

const OG_IMAGE_URL =
  "https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png";

const SITE_URL =
  process.env.NEXT_PUBLIC_WEB_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://dapp.decleanup.net";

export const metadata: Metadata = {
  title: "DeCleanup Rewards - Tokenize Your Environmental Impact",
  description:
    "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference on Celo.",
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DeCleanup Rewards",
  },
  // Add mobile-web-app-capable to address deprecation warning
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "DeCleanup Rewards - Tokenize Your Environmental Impact",
    description:
      "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference on Celo.",
    url: SITE_URL,
    siteName: "DeCleanup Rewards",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "DeCleanup Rewards - Tokenize Your Environmental Impact",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeCleanup Rewards - Tokenize Your Environmental Impact",
    description:
      "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference on Celo.",
    images: [OG_IMAGE_URL],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#58B12F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${bebasNeue.variable}`}>
      <head>
        {/* Open Graph Meta Tags */}
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="DeCleanup Rewards - Tokenize Your Environmental Impact" />
        <meta property="og:description" content="Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference on Celo." />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:secure_url" content={OG_IMAGE_URL} />
        <meta property="og:site_name" content="DeCleanup Rewards" />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DeCleanup Rewards - Tokenize Your Environmental Impact" />
        <meta name="twitter:description" content="Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference on Celo." />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
        <meta name="twitter:image:alt" content="DeCleanup Rewards - Tokenize Your Environmental Impact" />
        
        <meta name="mobile-web-app-capable" content="yes" />
      </head>

      <body
        className={`${GeistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-black`}
      >
        <RootClientBody>{children}</RootClientBody>
      </body>
    </html>
  );
}

