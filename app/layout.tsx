import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperTelque CRM",
  description: "Client journey, delivery, and documents in one workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
