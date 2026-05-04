import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: 'QodeIA - Ecosistema AI para Builders Hispanohablantes',
    template: '%s | QodeIA',
  },
  description:
    'QodeIA es un ecosistema completo de herramientas AI para builders hispanohablantes. Agente autónomo, IDE contextual (Howard OS) y comunidad en un solo lugar.',
  keywords: [
    'IA',
    'agente autónomo',
    'desarrolladores',
    'hispanohablantes',
    'builders',
    'IDE',
    'MCP',
    'NotebookLM',
  ],
  authors: [{ name: 'QodeIA Team' }],
  creator: 'QodeIA',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://qodeia.dev',
    title: 'QodeIA - Ecosistema AI para Builders Hispanohablantes',
    description:
      'Agente autónomo, IDE contextual y comunidad para desarrolladores de habla hispana',
    siteName: 'QodeIA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QodeIA',
    description: 'Ecosistema AI para builders hispanohablantes',
  },
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#10b981" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-slate-950 text-white">
        {children}
      </body>
    </html>
  );
}
