'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm rounded-[24px] border border-brand-mint/70 bg-white shadow-brandLg overflow-hidden">
        <div className="p-8 space-y-5">
          <div className="text-center mb-2">
            <img src="/project-hope-logo.png" alt="Project HOPE" className="w-40 mx-auto" />
          </div>

          <p className="font-script text-2xl text-brand-greenLight text-center -mt-1 mb-1">
            Forgot your password?
          </p>

          {sent ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-600">
                If an account exists for <strong>{email}</strong>, we've sent a link to reset your
                password. Check your inbox (and your Spam/Junk folder, just in case).
              </p>
              <a href="/login" className="text-sm text-brand-green underline underline-offset-2 font-medium">
                Back to log in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-500 text-center">
                Enter the email you signed up with and we'll send you a link to reset your password.
              </p>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="brand-input"
                required
              />

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green text-white rounded-full py-3 font-medium hover:bg-brand-greenDark hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="text-sm text-center text-slate-500 pt-1">
                <a href="/login" className="text-brand-green underline underline-offset-2 font-medium">
                  Back to log in
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
