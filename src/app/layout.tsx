import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import ClientShell from "@/components/ClientShell";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://tass-website.vercel.app'),
  title: "TASS 스마트 현장 및 수주 관리 시스템",
  description: "TASS 현장 지시용 공정 현황 모니터링 및 수주 관리 시스템",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/icons/icon.png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon.png',
    apple: [
      { url: '/icons/icon-512.png' },
      { url: '/icons/icon-192.png', sizes: '192x192' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TASS",
  },
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
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="apple-touch-icon" href="/icons/icon-512.png" />
        <link rel="shortcut icon" href="/icons/icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TASS" />
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
        <ServiceWorkerRegister />
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="top-right" zIndex={1000} />
          <AuthProvider>
            <ClientShell>
              {children}
            </ClientShell>
          </AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
