import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFH Compliance — Washington adult family home readiness",
  description:
    "Inspection-ready documentation, dynamic forms with e-signature, anonymous citation sharing, and WAC change tracking for Washington State adult family homes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
