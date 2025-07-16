import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UI Evaluation AI - プロフェッショナルなUI/UX分析ツール",
  description: "AIを活用してデザイン画像を分析し、WCAG、Apple HIG、Refactoring UIなどの権威あるガイドラインに基づいた専門的な改善提案を提供。具体的なTailwindCSSコード例付きで実装可能な提案を生成します。",
  keywords: ["UI分析", "UX改善", "WCAG", "Apple HIG", "Refactoring UI", "AIデザイン分析", "アクセシビリティ"],
  authors: [{ name: "UI Evaluation AI Team" }],
  openGraph: {
    title: "UI Evaluation AI - プロフェッショナルなUI/UX分析ツール",
    description: "AIを活用してデザイン画像を分析し、専門的な改善提案を提供",
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  );
}
