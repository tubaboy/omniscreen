import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/SidebarNav";
import { Monitor, LayoutDashboard } from "lucide-react";
import Link from "next/link";

const pjs = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: '--font-pjs',
});

export const metadata: Metadata = {
  title: "Omniscreen | 專業電子看板管理",
  description: "Digital Signage Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className={`${pjs.variable} font-sans bg-[#F8FAFC] text-[#1E293B] antialiased`}>
        {children}
      </body>
    </html>
  );
}

