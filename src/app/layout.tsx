import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { DemoBanner } from '@/components/DemoBanner';
import { SiteHeader } from '@/components/SiteHeader';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
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
        <ServiceWorkerRegistration />
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-50 inline-flex min-h-11 -translate-y-24 items-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <DemoBanner />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>

        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-muted">
            <p className="font-medium text-ink">Brill Ops</p>
            <p className="mt-1 max-w-2xl">
              Campaign infrastructure for global community operations. Every statistic on
              this site is calculated live from the database — none are maintained by hand.
              Imported historical figures are labelled where they were inferred or estimated.
            </p>
            <p className="mt-3">
              <Link href="/archive" className="inline-flex min-h-11 items-center rounded px-1 underline hover:text-ink">Archive</Link>
              <span className="mx-2 text-ink-faint">·</span>
              <Link href="/agents" className="inline-flex min-h-11 items-center rounded px-1 underline hover:text-ink">Agent directory</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
