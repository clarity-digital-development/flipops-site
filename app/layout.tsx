import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/app/components/theme-provider";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://flipops.io'),
  title: "FlipOps - Automation for Real Estate Investors & House Flippers",
  description: "Find more deals, analyze faster, and keep projects on budget with AI-powered automation built by an active real estate investor.",
  keywords: "real estate automation, house flipping software, real estate investor tools, deal analysis, property management automation",
  openGraph: {
    title: "FlipOps - Automation for Real Estate Investors",
    description: "Find more deals, analyze faster, and keep projects on budget with AI-powered automation.",
    type: "website",
    url: "https://flipops.io",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "FlipOps - Real Estate Automation"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "FlipOps - Automation for Real Estate Investors",
    description: "Find more deals, analyze faster, and keep projects on budget with AI-powered automation.",
    images: ["/og-image.png"]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=TikTok+Sans:opsz,wght@12..36,300..900&display=swap"
            rel="stylesheet"
            precedence="default"
          />
        </head>
        <body
          className={`${geistMono.variable} antialiased font-sans`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
