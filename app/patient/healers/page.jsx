'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';
import BrandAccent from '../../../components/BrandAccent';
import HealerAvatarFallback from '../../../components/HealerAvatarFallback';
import { fetchHealerNames } from '../../../lib/healerNames';
import { stripCategoryPrefix } from '../../../lib/specializationLabel';

export default function AllHealersPage() {
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
    const { data } = await supabase
      .from('healer_profiles')
      .select('user_id, title, location, photo_url, healer_categories(category_id)')
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .order('user_id');

    const namesById = await fetchHealerNames(supabase, (data || []).map((h) => h.user_id));
    setHealers((data || []).map((h) => ({ ...h, profile: namesById[h.user_id] })));
    setLoading(false);
  }

  const visibleHealers = categoryFilter
    ? healers.filter((h) => h.healer_categories?.some((hc) => hc.category_id === categoryFilter))
    : healers;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <AppNav />
      <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-10 overflow-hidden">
        <div className="text-center mb-8 relative z-10">
          <h1 className="font-script text-6xl text-brand-green leading-tight">
            Meet All Our Pranic Healers
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Browse every healer's profile, or filter by what you're looking for.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-10 relative z-10">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-xs font-medium rounded-full px-4 py-2 transition ${
              categoryFilter === null
                ? 'bg-brand-green text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-brand-mint'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`text-xs font-medium rounded-full px-4 py-2 transition ${
                categoryFilter === c.id
                  ? 'bg-brand-green text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-brand-mint'
              }`}
            >
              {stripCategoryPrefix(c.name)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-500 text-sm relative z-10">Loading healers…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10 relative z-10">
            {visibleHealers.map((h) => (
              <Link key={h.user_id} href={`/patient/healer/${h.user_id}`} className="text-center group">
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

        <BrandAccent />
      </div>
    </div>
  );
}
