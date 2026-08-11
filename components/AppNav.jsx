'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import SignOutButton from './SignOutButton';

const PATIENT_TABS = [
  { href: '/patient/portal', label: 'My Portal' },
  { href: '/patient', label: 'Book a Session' },
  { href: '/patient/healers', label: 'Browse Healers' },
  { href: '/services', label: 'Services' },
  { href: '/patient/payments', label: 'My Payments' },
];

const HEALER_TABS = [
  { href: '/healer', label: 'Availability and Bookings' },
  { href: '/services', label: 'Services' },
  { href: '/healer/calendar', label: 'My Calendar' },
  { href: '/healer/patients', label: 'My Patients' },
  { href: '/healer/payments', label: 'My Payments' },
  { href: '/healer/profile', label: 'My Profile' },
];

const LOGGED_OUT_TABS = [
  { href: '/', label: 'Home' },
  { href: '/contact', label: 'Contact Us' },
];

// Same set, same order, everywhere admin goes - the dashboard's own
// sub-sections (Summary/Calendar/etc.) are real linkable URLs via ?tab=,
// not separate internal-only state, so this nav can point straight at them.
const ADMIN_TABS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/admin?tab=summary', label: 'Summary' },
  { href: '/admin?tab=calendar', label: 'Calendar' },
  { href: '/admin?tab=healers', label: 'Healers' },
  { href: '/admin?tab=patients', label: 'Patients' },
  { href: '/admin?tab=payments', label: 'Payments' },
  { href: '/admin?tab=interactive', label: 'Interactive' },
  { href: '/contact', label: 'Contact Us' },
];

function AppNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'out' | 'patient' | 'healer' | 'admin'

  useEffect(() => {
    checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange(() => checkSession());
    return () => listener.subscription.unsubscribe();
  }, []);

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setStatus('out');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    setStatus(profile?.role || 'patient');
  }

  const tabs =
    status === 'patient' ? PATIENT_TABS : status === 'healer' ? HEALER_TABS : status === 'admin' ? ADMIN_TABS : LOGGED_OUT_TABS;

  function isActive(href) {
    if (href.includes('?tab=')) {
      const [path, tabValue] = href.split('?tab=');
      const currentTab = searchParams.get('tab') || 'summary';
      return pathname === path && currentTab === tabValue;
    }
    if (href === '/') return pathname === '/';
    if (href === '/patient' || href === '/healer' || href === '/admin') return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="mb-6 sticky top-0 z-40 -mx-6 px-6 pt-4 pb-3 bg-brand-paper/85 backdrop-blur-md border-b border-brand-mint/60">
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-2">
        <Link href="/" className="shrink-0">
          <img src="/project-hope-logo.png" alt="Project HOPE" className="h-9" />
        </Link>

        <nav className="flex items-center gap-1 flex-wrap">
          {status !== 'loading' &&
            tabs.map((tab) => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`text-[13px] font-medium px-3 py-2 rounded-full transition-all duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-brand-green text-white shadow-sm'
                      : 'text-brand-ink/70 border border-slate-200 hover:bg-brand-mintSoft hover:border-brand-green/30 hover:text-brand-green'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}

          {status === 'out' && (
            <Link href="/login" className="btn-primary btn-sm whitespace-nowrap shrink-0">
              Log in / Sign up
            </Link>
          )}
          {status !== 'loading' && status !== 'out' && (
            <span className="shrink-0">
              <SignOutButton />
            </span>
          )}
        </nav>
      </div>
    </div>
  );
}

export default function AppNav() {
  return (
    <Suspense fallback={<div className="mb-6 h-[60px]" />}>
      <AppNavInner />
    </Suspense>
  );
}
