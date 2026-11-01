import type { ReactNode } from "react";
import { AppHeader } from "../components/AppHeader";
import { ProjectProvider } from "../store";
import "./globals.css";

export const metadata = { title: "Microgrid design tool" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <ProjectProvider>
          <AppHeader />
          <main>{children}</main>
        </ProjectProvider>
      </body>
    </html>
  );
}
