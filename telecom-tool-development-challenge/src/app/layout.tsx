import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PreferencesProvider } from "@/lib/preferences-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "BillClarity · MI4, INC. | kdmirah lab — Telecom Bill Detective",
  description:
    "Bilingual (English / Bahasa Melayu) telecom bill decoder & support prep studio by MI4, INC. · kdmirah lab. Decode mobile and broadband charges in Malaysian Ringgit (RM), check proration math, and prepare an actionable support brief.",
};

const themeInitScript = `
(function() {
  try {
    var mode = localStorage.getItem('billclarity_theme') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = mode === 'dark' || (mode === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    var lang = localStorage.getItem('billclarity_lang');
    if (lang === 'ms' || lang === 'en') {
      document.documentElement.lang = lang;
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-[var(--bg)] font-sans text-[var(--ink)] antialiased">
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
