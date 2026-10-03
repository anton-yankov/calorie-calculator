import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AiAllowanceProvider } from "@/components/AiAllowance";
import { AnalysisProvider } from "@/components/AnalysisProvider";
import { LightboxProvider } from "@/components/ImageLightbox";
import { Sidebar } from "@/components/Sidebar";
import { ToastMark } from "@/components/ToastMark";
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AiAllowanceProvider>
          {/* Desktop: sidebar on the left, the page beside it. Phones: one column. */}
          <div className="flex flex-1">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopNav />
              <LightboxProvider>
                <AnalysisProvider>{children}</AnalysisProvider>
              </LightboxProvider>
            </div>
          </div>
        </AiAllowanceProvider>
        <Toaster
          position="bottom-center"
          icons={{
            success: <ToastMark tone="success" />,
            info: <ToastMark tone="info" />,
            warning: <ToastMark tone="error" />,
            error: <ToastMark tone="error" />,
          }}
          toastOptions={{
            style: {
              background: "var(--surface-raised)",
              border: "none",
              color: "var(--foreground)",
              borderRadius: "16px",
              boxShadow: "0 12px 30px -10px rgba(0, 0, 0, 0.7)",
              fontSize: "14px",
              fontWeight: 650,
            },
            actionButtonStyle: {
              background: "var(--surface)",
              color: "var(--accent)",
              borderRadius: "10px",
              height: "36px",
              padding: "0 12px",
              fontSize: "13.5px",
              fontWeight: 750,
            },
          }}
        />
      </body>
    </html>
  );
}
