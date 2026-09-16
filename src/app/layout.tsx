import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autoškola",
  description: "Systém pro správu autoškoly",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
