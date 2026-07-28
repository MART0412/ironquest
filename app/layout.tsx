import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { backgroundStyleFrom, themeStyleFromVars } from "@/lib/game/theme";
import { createClient } from "@/lib/supabase/server";

type ThemeMeta = { vars?: unknown };

/**
 * The caller's equipped app-wide art-style theme: CSS-var token overrides plus
 * an optional CSS-only background layer.
 */
async function equippedThemeStyle() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from("cosmetic_equipped")
    .select("cosmetics!inner(type, metadata)")
    .eq("cosmetics.type", "ui_theme")
    .maybeSingle();

  const meta = (data?.cosmetics?.metadata ?? null) as ThemeMeta | null;
  return { ...themeStyleFromVars(meta?.vars), ...backgroundStyleFrom(meta) };
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IronQuest",
  description: "Gamified calisthenics & nutrition — train, eat, level up.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Equipped art-style theme, applied SSR on <body> so tokens are present on
  // first paint (no flash). Custom properties inherit to every page.
  const themeStyle = await equippedThemeStyle();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={themeStyle}>
        {children}
      </body>
    </html>
  );
}
