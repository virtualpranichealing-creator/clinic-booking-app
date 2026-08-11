'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from './SignOutButton';

const TABS = [
  { href: '/patient/portal', label: 'My Portal' },
  { href: '/patient', label: 'Book a Session' },
  { href: '/patient/healers', label: 'Browse Healers' },
  { href: '/patient/packages', label: 'Packages' },
  { href: '/patient/payments', label: 'My Payments' },
  { href: '/patient/profile', label: 'My Profile' },
];

export default function PatientNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 sticky top-0 z-40 -mx-6 px-6 pt-4 pb-3 bg-brand-paper/85 backdrop-blur-md border-b border-brand-mint/60">
      <div className="max-w-5xl mx-auto">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/">
            <img src="/project-hope-logo.png" alt="Project HOPE" className="h-11" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-ghost btn-sm">
              🏠 Home
            </Link>
            <SignOutButton />
          </div>
        </div>

        <nav className="flex gap-1.5 flex-wrap">
          {TABS.map((tab) => {
            const active = tab.href === '/patient' ? pathname === '/patient' : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-sm font-medium px-4 py-2 rounded-full transition-all duration-150 ${
                  active
                    ? 'bg-brand-green text-white shadow-sm'
                    : 'text-brand-ink/70 hover:bg-brand-mintSoft hover:text-brand-green'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
