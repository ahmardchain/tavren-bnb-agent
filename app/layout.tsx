import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tavren — Room to breathe",
  description: "Inspect a Venus Core loan on BSC testnet and prepare a capped repayment before its buffer disappears.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
