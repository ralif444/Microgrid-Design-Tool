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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
