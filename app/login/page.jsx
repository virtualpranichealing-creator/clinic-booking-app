'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, getCurrentProfile } from '../../lib/supabaseClient';
import { readableAuthError } from '../../lib/authError';

function LoginPageInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(readableAuthError(signInError));
      setLoading(false);
      return;
    }

    const profile = await getCurrentProfile();
    // Only honor `next` for patients landing on a patient-side page - a
    // healer/admin account clicking a patient-facing "Book now" link should
    // still land on their own dashboard, not a page they can't use.
    const nextAllowed =
      next && (next.startsWith('/services') || (next.startsWith('/patient') && profile?.role === 'patient'));
    if (nextAllowed) {
      router.push(next);
    } else {
      router.push(`/${profile?.role || 'patient'}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm rounded-[24px] border border-brand-mint/70 bg-white shadow-brandLg overflow-hidden">
        <svg width="110" height="110" viewBox="0 0 130 130" className="absolute top-0 left-0 pointer-events-none">
          <path d="M0,0 Q20,10 25,30 Q35,15 55,20 Q40,30 40,45 Q25,35 15,45 Q20,25 0,25 Z" fill="#7FB07A" opacity="0.55" />
          <path d="M0,15 Q25,20 30,45 Q15,35 0,50 Z" fill="#4F8F52" opacity="0.7" />
          <path d="M0,0 Q10,5 12,15 Q5,10 0,12 Z" fill="#4F8F52" opacity="0.85" />
        </svg>

        <img
          src="/lotus-flower.png"
          alt=""
          className="absolute -bottom-4 -right-6 w-64 opacity-60 pointer-events-none select-none"
        />

        <form onSubmit={handleLogin} className="relative p-8 pt-11 space-y-4">
          <div className="text-center mb-2">
            <img src="/project-hope-logo.png" alt="Project HOPE" className="w-40 mx-auto" />
          </div>

          <p className="font-script text-2xl text-brand-greenLight text-center -mt-1 mb-1">Welcome back</p>
          <p className="text-sm text-slate-500 text-center mb-3">
            Log in to book a Pranic Healing Session.
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="brand-input"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="brand-input"
            required
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="text-right -mt-1">
            <a href="/forgot-password" className="text-xs text-brand-green underline underline-offset-2">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-green text-white rounded-full py-3 font-medium hover:bg-brand-greenDark hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-sm text-center text-slate-500 pt-1">
            No account yet?{' '}
            <a
              href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
              className="text-brand-green underline underline-offset-2 font-medium"
            >
              Sign up to start
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginPageInner />
    </Suspense>
  );
}
