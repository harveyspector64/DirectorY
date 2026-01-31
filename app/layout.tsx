import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Director Radar",
  description: "Browse directors and compare attributes"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-950">
          <header className="border-b border-slate-800 px-6 py-4">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-100">Director Radar</h1>
                <p className="text-sm text-slate-400">Browse, filter, and compare directors</p>
              </div>
              <nav className="flex gap-4 text-sm">
                <a href="/" className="font-medium">Search</a>
                <a href="/compare" className="font-medium">Compare</a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          <footer className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">
            <div className="mx-auto max-w-6xl">
              Data source: <code>public/data/atlas/directors.json</code>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
