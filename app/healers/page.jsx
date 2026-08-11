'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import HealerAvatarFallback from '../../components/HealerAvatarFallback';
import AppNav from '../../components/AppNav';

export default function PublicHealersPage() {
  const [healers, setHealers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
    loadHealers();
  }, []);

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  }

  async function loadHealers() {
    setLoading(true);
    const { data: healerRows } = await supabase
      .from('healer_profiles')
      .select('user_id, title, photo_url, healer_categories(category_id)')
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    const ids = (healerRows || []).map((h) => h.user_id);
    let namesById = {};
    if (ids.length > 0) {
      const { data: names } = await supabase
        .from('healer_public_profiles')
        .select('id, nickname, full_name')
        .in('id', ids);
      namesById = Object.fromEntries((names || []).map((n) => [n.id, n]));
    }

    setHealers((healerRows || []).map((h) => ({ ...h, profile: namesById[h.user_id] })));
    setLoading(false);
  }

  const visibleHealers = categoryFilter
    ? healers.filter((h) => h.healer_categories?.some((hc) => hc.category_id === categoryFilter))
    : healers;

  return (
    <div className="min-h-screen">
      <AppNav />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="brand-heading-script">Meet All Our Pranic Healers</h1>
          <p className="text-sm text-slate-500 mt-2">
            Browse every healer's profile, or filter by what you're looking for. Sign in to book.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-xs font-medium rounded-full px-4 py-2 transition ${
              categoryFilter === null ? 'bg-brand-green text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-mint'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`text-xs font-medium rounded-full px-4 py-2 transition ${
                categoryFilter === c.id ? 'bg-brand-green text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-mint'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-500 text-sm">Loading healers…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10">
            {visibleHealers.map((h) => (
              <Link
                key={h.user_id}
                href={`/login?next=${encodeURIComponent(`/patient/healer/${h.user_id}`)}`}
                className="text-center group"
              >
                <div className="w-28 h-28 mx-auto rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-brand-green transition">
                  {h.photo_url ? (
                    <img
                      src={h.photo_url}
                      alt={h.profile?.nickname || h.profile?.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <HealerAvatarFallback size={112} />
                  )}
                </div>
                <p className="mt-3 text-sm font-bold italic uppercase tracking-wide text-brand-green">
                  {h.profile?.nickname || h.profile?.full_name}
                </p>
                {h.title && <p className="text-xs text-slate-500 mt-0.5">{h.title}</p>}
              </Link>
            ))}
            {visibleHealers.length === 0 && (
              <p className="col-span-4 text-center text-slate-500 text-sm">
                No healers found{categoryFilter ? ' in this category' : ''} yet.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
