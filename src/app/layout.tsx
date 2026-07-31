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
  title: "Partner Management & Blog Gen",
  description: "Manage vendors, extract emails, and generate blogs",
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
