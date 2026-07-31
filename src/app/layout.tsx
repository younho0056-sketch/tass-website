import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import ClientShell from "@/components/ClientShell";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://tass-website.vercel.app'),
  title: "TASS (타스) - 스마트 산업 안전 솔루션 전문 기업",
  description: "사람을 위한, 사람이 먼저인, 사람을 향하는 스마트 산업 안전 기술 전문 기업 주식회사 TASS입니다.",
  openGraph: {
    title: "TASS (타스) - 스마트 산업 안전 솔루션 전문 기업",
    description: "사람을 위한, 사람이 먼저인, 사람을 향하는 스마트 산업 안전 기술 전문 기업 주식회사 TASS입니다.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "TASS 스마트 산업 안전 솔루션 전문 기업",
      },
    ],
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "TASS (타스) - 스마트 산업 안전 솔루션 전문 기업",
    description: "사람을 위한, 사람이 먼저인, 사람을 향하는 스마트 산업 안전 기술 전문 기업 주식회사 TASS입니다.",
    images: ["/images/og-image.png"],
  },
};

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ColorSchemeScript />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="TASS (타스) - 스마트 산업 안전 솔루션 전문 기업" />
        <meta property="og:description" content="사람을 위한, 사람이 먼저인, 사람을 향하는 스마트 산업 안전 기술 전문 기업 주식회사 TASS입니다." />
        <meta property="og:image" content="/images/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="TASS (타스) - 스마트 산업 안전 솔루션 전문 기업" />
        <meta name="twitter:description" content="사람을 위한, 사람이 먼저인, 사람을 향하는 스마트 산업 안전 기술 전문 기업 주식회사 TASS입니다." />
        <meta name="twitter:image" content="/images/og-image.png" />
      </head>
      <body className="min-h-full flex flex-col m-0 p-0">
        <MantineProvider theme={theme} defaultColorScheme="light">
          <ClientShell>
            {children}
          </ClientShell>
        </MantineProvider>
      </body>
    </html>
  );
}
