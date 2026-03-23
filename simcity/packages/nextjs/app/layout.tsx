import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "../providers";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SimCity — Agentic Economic Game",
  description: "Build a city with autonomous agents, real DeFi yield, and x402 micropayments.",
};

const nav = [
  { name: "Home", href: "/" },
  { name: "Marketplace", href: "/marketplace" },
  { name: "Agents", href: "/agents" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <nav style={{ borderBottom: "1px solid #333", padding: "1rem 2rem", display: "flex", gap: "2rem" }}>
            {nav.map((link) => (
              <Link key={link.href} href={link.href} style={{ color: "#00d4ff", textDecoration: "none" }}>
                {link.name}
              </Link>
            ))}
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}