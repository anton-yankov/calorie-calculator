import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AnalysisProvider } from "@/components/AnalysisProvider";
import { LightboxProvider } from "@/components/ImageLightbox";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

// viewport-fit=cover makes the safe-area-inset env() values real inside the
// installed app (translucent status bar), which the image viewer pads by
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Vercel provides the production URL at build time; localhost is the dev fallback
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  title: "Calorie Calculator",
  description: "Photo of a meal in, estimated calories and macros out.",
  appleWebApp: {
    capable: true,
    title: "Calories",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TopNav />
        <LightboxProvider>
          <AnalysisProvider>{children}</AnalysisProvider>
        </LightboxProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              color: "var(--foreground)",
              borderRadius: "10px",
            },
            actionButtonStyle: {
              background: "var(--accent)",
              color: "var(--background)",
            },
          }}
        />
      </body>
    </html>
  );
}
