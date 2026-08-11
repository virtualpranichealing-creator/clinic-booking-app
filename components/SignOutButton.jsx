'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function SignOutButton({ className = '' }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={
        className ||
        'text-sm px-4 py-2 rounded-full text-slate-500 border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50'
      }
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
