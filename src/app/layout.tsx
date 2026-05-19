import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "取扱サロン検索",
  description: "お近くの取扱サロンを検索できます",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-800">{children}</body>
    </html>
  );
}
