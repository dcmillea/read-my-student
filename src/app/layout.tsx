import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Footer from "@/components/marketing/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),

  // 2. SEO Title & Description
  title: {
    default: "ReadMyStudent | The Secure Academic Recommendations Platform",
    template: "%s | ReadMyStudent", // This allows sub-pages to look like: "Login | ReadMyStudent"
  },
  description:
    "Simplify the academic letter of recommendation process. ReadMyStudent helps faculty manage requests and write secure references, saving time while ensuring student privacy.",

  // 3. OpenGraph (Facebook, LinkedIn, iMessage, Slack)
  openGraph: {
    title: "ReadMyStudent | Secure Academic Recommendations",
    description:
      "The trusted platform for requesting, writing, and managing academic recommendation letters simply and securely.",
    url: baseUrl,
    siteName: "ReadMyStudent",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png", // We will create this file next
        width: 1200,
        height: 630,
        alt: "ReadMyStudent Platform",
      },
    ],
  },

  // 4. Twitter Card (X)
  twitter: {
    card: "summary_large_image",
    title: "ReadMyStudent",
    description:
      "Secure, respectful recommendation letters for students and faculty.",
    images: ["/og-image.png"], // Re-using the OG image
  },

  // 5. Icons
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png", // Optional, if you have it
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Footer />
        <Toaster richColors position='top-center' />
      </body>
    </html>
  );
}
