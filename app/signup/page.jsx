'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function SignupPageInner() {
  const [role, setRole] = useState('patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  async function handleSignup(e) {
    e.preventDefault();
    if (!ndaAgreed) {
      setError('Please agree to the confidentiality agreement to continue.');
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });

if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // With email confirmation off, Supabase signals "this email already has an
    // account" by returning a user with an empty identities array, instead of
    // a normal error (this avoids leaking which emails are registered).
    if (data?.user?.identities?.length === 0) {
      setError('An account with this email already exists. Please sign in instead.');
      setLoading(false);
      return;
    }

const userId = data.user?.id;

    if (userId) {
      await supabase.from('profiles').update({ nda_agreed_at: new Date().toISOString() }).eq('id', userId);
    }

    fetch('/api/notify-admin-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, role, email }),
    }).catch((err) => console.error('Failed to send admin signup notification:', err));

    if (role === 'healer' && userId) {
      const { error: healerError } = await supabase
        .from('healer_profiles')
        .insert({ user_id: userId });

      if (healerError) {
        setError(healerError.message);
        setLoading(false);
        return;
      }
    }

    const nextAllowed = next && (next.startsWith('/services') || (next.startsWith('/patient') && role === 'patient'));
    if (nextAllowed) {
      router.push(next);
    } else {
      router.push(`/${role}`);
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

        <form onSubmit={handleSignup} className="relative p-8 pt-11 space-y-4">
          <div className="text-center mb-2">
            <img src="/project-hope-logo.png" alt="Project HOPE" className="w-40 mx-auto" />
          </div>

          <p className="font-script text-2xl text-brand-greenLight text-center -mt-1 mb-1">
            Let's get started
          </p>
          <p className="text-sm text-slate-500 text-center mb-1">
            No account yet? Sign up to start booking Pranic Healing sessions.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRole('patient')}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                role === 'patient'
                  ? 'bg-brand-green text-white shadow-sm'
                  : 'border border-brand-green/40 text-brand-green hover:bg-brand-mintSoft'
              }`}
            >
              I&apos;m a patient
            </button>
            <button
              type="button"
              onClick={() => setRole('healer')}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                role === 'healer'
                  ? 'bg-brand-green text-white shadow-sm'
                  : 'border border-brand-green/40 text-brand-green hover:bg-brand-mintSoft'
              }`}
            >
              I&apos;m a Pranic Healer
            </button>
          </div>

          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="brand-input"
            required
          />
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
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="brand-input"
            required
            minLength={6}
          />

          <label className="flex items-start gap-2 text-xs text-slate-500 bg-brand-mintSoft rounded-xl p-3">
            <input
              type="checkbox"
              checked={ndaAgreed}
              onChange={(e) => setNdaAgreed(e.target.checked)}
              className="mt-0.5"
              required
            />
            <span>
              I agree to keep all information shared during Pranic Healing sessions strictly
              confidential, and understand that Project HOPE handles my own information with the
              same care and confidentiality.
            </span>
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-green text-white rounded-full py-3 font-medium hover:bg-brand-greenDark hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-sm text-center text-slate-500 pt-1">
            Already have an account?{' '}
            <a
              href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
              className="text-brand-green underline underline-offset-2 font-medium"
            >
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignupPageInner />
    </Suspense>
  );
}
