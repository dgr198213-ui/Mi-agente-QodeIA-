import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QodeIA Agent",
  description: "Autonomous Agent for QodeIA Ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
