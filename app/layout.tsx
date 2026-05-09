import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI 图片工作流",
  description: "节点式 AI 图片生成工作流编辑器。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
