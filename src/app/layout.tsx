import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getRegionConfig } from "@/lib/region";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  const config = getRegionConfig();
  return {
    title: `Order Lookup ${config.titleSuffix}`,
    description: "Last known location of a Harvey Norman Ireland order.",
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IE"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      {/* browser extensions such as ColorZilla add attributes to body before hydration */}
      <body
        className="font-sans antialiased bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
