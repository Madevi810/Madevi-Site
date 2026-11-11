import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
// A fresh CSP nonce is generated per request, so HTML must not be prerendered.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "MADEVI", description: "Ruang untuk belajar, berkarya, dan berkembang." };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce=(await headers()).get("x-nonce")||undefined;
  const themeScript='try{document.documentElement.dataset.theme=localStorage.getItem("madevi-theme")==="dark"?"dark":"light"}catch{}';
  return <html lang="id" suppressHydrationWarning><head><script nonce={nonce} dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>;
}

