import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AnimatedBackdrop } from "@/components/layout/AnimatedBackdrop";
import { ConsentBanner } from "@/components/layout/ConsentBanner";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Navbar } from "@/components/layout/Navbar";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { StoreHydration } from "@/components/layout/StoreHydration";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScamShield 3D",
  description:
    "Understand suspicious messages with clear, explainable scam analysis.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#07111f" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} min-h-screen font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ServiceWorkerRegistration />
          <StoreHydration />
          <ConsentBanner />
          <AnimatedBackdrop />
          <Navbar />
          <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-10">
            {children}
          </main>
          <Footer />
          <MobileTabBar />
        </ThemeProvider>
      </body>
    </html>
  );
}
