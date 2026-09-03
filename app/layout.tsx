import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "./ConvexClientProvider";
import Navbar from "./components/Navbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

import Provider from "./provider";
import { AppSidebar } from "./components/Appsidebar";
import MatrixBackground from "./components/MatrixBackground";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Earth monitor AI",
  description:
    "Cron jobs detect natural disasters and AI generates a report of urgency to report to communities to evacuate and save lives.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <MatrixBackground />
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ConvexClientProvider>
              <Provider>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full flex-col">
                    <Navbar />
                    <div className="flex flex-1 overflow-hidden">
                      <AppSidebar />
                      <SidebarInset className="flex-1 overflow-auto bg-transparent">
                        <main className="p-4 lg:p-6">{children}</main>
                      </SidebarInset>
                    </div>
                  </div>
                </SidebarProvider>

                <Toaster richColors />
              </Provider>
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
