import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Brill Ops',
    template: '%s · Brill Ops',
  },
  description:
    'A reusable campaign management platform for Ingress community operations and ' +
    'crossfaction global events.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Brill Ops',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-muted">
            <p className="font-medium text-ink">Brill Ops</p>
            <p className="mt-1 max-w-2xl">
              Campaign infrastructure for global community operations. Every statistic on
              this site is calculated live from the database — none are maintained by hand.
              Imported historical figures are labelled where they were inferred or estimated.
            </p>
            <p className="mt-3">
              <Link href="/archive" className="underline hover:text-ink">Archive</Link>
              <span className="mx-2 text-ink-faint">·</span>
              <Link href="/agents" className="underline hover:text-ink">Agent directory</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
