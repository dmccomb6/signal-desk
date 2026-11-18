import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Desk",
  description: "Daily technical signals and backtests for a personal stock watchlist",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="dot" /> Signal Desk
          </Link>
          <span className="muted small">Rules-based signals. Not financial advice.</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
