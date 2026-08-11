import Link from 'next/link';
import { Archive, Radar, Users } from 'lucide-react';

const NAV = [
  { href: '/',        label: 'Campaign', icon: Radar },
  { href: '/agents',  label: 'Agents',   icon: Users },
  { href: '/archive', label: 'Archive',  icon: Archive },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg px-1 transition hover:opacity-80 active:translate-y-px">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
            BO
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">Brill Ops</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-slate-100 hover:text-ink active:bg-slate-200"
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
