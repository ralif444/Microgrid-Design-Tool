import type { ReactNode } from "react";
import Link from "next/link";
import { EngineBadge } from "../components/EngineBadge";
import { ProjectProvider } from "../store";
import "./globals.css";

export const metadata = { title: "Microgrid design tool" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <ProjectProvider>
          <header>
            <Link href="/">Microgrid design tool</Link>
            <nav aria-label="Pipeline">
              <Link href="/power-flow/">Power flow (M1)</Link>
            </nav>
            <EngineBadge />
          </header>
          <main>{children}</main>
        </ProjectProvider>
      </body>
    </html>
  );
}
