import type { ReactNode } from "react";
import { AppHeader } from "../components/AppHeader";
import { CatalogProvider } from "../components/Catalog";
import { ProjectProvider } from "../store";
import "./globals.css";

export const metadata = { title: "Microgrid design tool" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <ProjectProvider>
          <CatalogProvider>
            <AppHeader />
            <main>{children}</main>
          </CatalogProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
