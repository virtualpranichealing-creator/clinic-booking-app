'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import SignOutButton from './SignOutButton';

const PATIENT_TABS = [
  { href: '/patient/portal', label: 'My Portal' },
  { href: '/patient', label: 'Book a Session' },
  { href: '/patient/healers', label: 'Browse Healers' },
  { href: '/patient/packages', label: 'Packages' },
  { href: '/patient/payments', label: 'My Payments' },
  { href: '/patient/profile', label: 'My Profile' },
];

const HEALER_TABS = [
  { href: '/healer', label: 'Availability & Bookings' },
  { href: '/healer/calendar', label: 'My Calendar' },
  { href: '/healer/patients', label: 'My Patients' },
  { href: '/healer/payments', label: 'My Payments' },
  { href: '/healer/profile', label: 'My Profile' },
];

const ADMIN_TABS = [{ href: '/admin', label: 'Admin Dashboard' }];

export default function PublicHeader() {
  const pathname = usePathname();
  const [status, setStatus] = useState('loading'); // 'loading' | 'out' | role string

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

  const dashboardTabs =
    status === 'patient' ? PATIENT_TABS : status === 'healer' ? HEALER_TABS : status === 'admin' ? ADMIN_TABS : null;

  return (
    <header className="max-w-5xl mx-auto px-6 pt-6">
      <div className="flex items-center justify-between mb-3">
        <Link href="/">
          <img src="/project-hope-logo.png" alt="Project HOPE" className="h-11" />
        </Link>

        {status === 'loading' ? null : dashboardTabs ? (
          <SignOutButton />
        ) : (
          <nav className="flex items-center gap-2">
            <Link href="/" className="btn-ghost btn-sm">
              Home
            </Link>
            <Link href="/contact" className="btn-ghost btn-sm">
              Contact Us
            </Link>
            <Link href="/login" className="btn-ghost btn-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary btn-sm">
              Sign up
            </Link>
          </nav>
        )}
      </div>

      {/* Logged in: show the real dashboard tabs (plus Home/Services/Contact),
          so browsing a public page never feels like a dead end - always a
          clear way back into the dashboard. */}
      {dashboardTabs && (
        <nav className="flex gap-1.5 flex-wrap pb-3 border-b border-brand-mint/60">
          <Link
            href="/"
            className={`text-sm font-medium px-4 py-2 rounded-full transition-all duration-150 ${
              pathname === '/'
                ? 'bg-brand-green text-white shadow-sm'
                : 'text-brand-ink/70 hover:bg-brand-mintSoft hover:text-brand-green'
            }`}
          >
            Home
          </Link>
          {dashboardTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-all duration-150 ${
                (pathname.startsWith(tab.href) && tab.href !== '/patient') || pathname === tab.href
                  ? 'bg-brand-green text-white shadow-sm'
                  : 'text-brand-ink/70 hover:bg-brand-mintSoft hover:text-brand-green'
              }`}
            >
              {tab.label}
            </Link>
          ))}
          <Link
            href="/services"
            className={`text-sm font-medium px-4 py-2 rounded-full transition-all duration-150 ${
              pathname === '/services'
                ? 'bg-brand-green text-white shadow-sm'
                : 'text-brand-ink/70 hover:bg-brand-mintSoft hover:text-brand-green'
            }`}
          >
            Services
          </Link>
          <Link
            href="/contact"
            className={`text-sm font-medium px-4 py-2 rounded-full transition-all duration-150 ${
              pathname === '/contact'
                ? 'bg-brand-green text-white shadow-sm'
                : 'text-brand-ink/70 hover:bg-brand-mintSoft hover:text-brand-green'
            }`}
          >
            Contact Us
          </Link>
        </nav>
      )}
    </header>
  );
}
