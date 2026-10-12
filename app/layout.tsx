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

// 브라우저 탭 제목과 검색용 설명
export const metadata: Metadata = {
  title: "업무 진행판",
  description:
    "행정 업무를 할 일 단위로 등록하고 진행도를 한눈에 보여주는 개인용 진행판",
  // 개인용 도구라서 검색 사이트에 노출되지 않게 한다 (PRD 7장 ④)
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
