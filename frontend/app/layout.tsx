import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { CatalogProvider } from "../components/Catalog";
import { ProjectProvider } from "../store";
import "@ibm/plex-sans/css/ibm-plex-sans-default.min.css";
import "@ibm/plex-mono/css/ibm-plex-mono-default.min.css";
import "./carbon.css";
import "./tokens.css";
import "./globals.css";

export const metadata = { title: "Microgrid design tool" };

// Applies the saved theme before first paint (no light flash); default light, storage errors ignored.
// Key "mdt-theme" as THEME_KEY in components/ThemeSwitch.tsx (a client module, not importable here).
const THEME_SCRIPT = `try{if(localStorage.getItem("mdt-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is set by the script before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ProjectProvider>
          <CatalogProvider>
            <AppShell>{children}</AppShell>
          </CatalogProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
