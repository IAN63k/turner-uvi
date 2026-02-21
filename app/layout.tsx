import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turner — Gestión de Turnos",
  description: "Sistema de gestión de turnos para atención virtual. Toma tu turno y espera cómodamente.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer className="fixed bottom-0 left-0 w-full pointer-events-none py-2 text-center">
          <span className="text-[10px] font-mono text-muted/40 tracking-wider select-none">
            Turner v1.0.0 — UVI
          </span>
        </footer>
      </body>
    </html>
  );
}
