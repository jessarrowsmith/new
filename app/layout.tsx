import type { Metadata, Viewport } from "next";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav, MobileHeader, Sidebar } from "@/components/nav";

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Plan your meals, log your food, build your shopping list.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Sidebar />
          <MobileHeader />
          <main className="pb-24 md:ml-60 md:pb-8">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
              {children}
            </div>
          </main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
