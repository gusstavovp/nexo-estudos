import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nexo — seu universo de estudos",
  description:
    "Conecte ideias, organize matérias e encontre seu próximo conhecimento.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
