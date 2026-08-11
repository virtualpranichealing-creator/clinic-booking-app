'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase's reset-password email link logs the user into a temporary
    // session automatically when they land here - just confirm it's there
    // before letting them submit a new password.
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/login'), 2500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm rounded-[24px] border border-brand-mint/70 bg-white shadow-brandLg overflow-hidden">
        <div className="p-8 space-y-5">
          <div className="text-center mb-2">
            <img src="/project-hope-logo.png" alt="Project HOPE" className="w-40 mx-auto" />
          </div>

          <p className="font-script text-2xl text-brand-greenLight text-center -mt-1 mb-1">
            Set a new password
          </p>

          {done ? (
            <p className="text-sm text-slate-600 text-center">
              ✅ Your password has been updated. Redirecting you to log in…
            </p>
          ) : !ready ? (
            <p className="text-sm text-slate-500 text-center">
              This link may have expired. Please request a new one from the{' '}
              <a href="/forgot-password" className="text-brand-green underline underline-offset-2">
                forgot password page
              </a>
              .
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="brand-input"
                required
                minLength={6}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="brand-input"
                required
                minLength={6}
              />

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white rounded-full py-3 font-medium hover:bg-brand-greenDark hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
