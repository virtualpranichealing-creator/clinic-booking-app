'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import AppNav from '../../../../components/AppNav';
import BrandAccent from '../../../../components/BrandAccent';
import HealerAvatarFallback from '../../../../components/HealerAvatarFallback';
import { fetchHealerNames } from '../../../../lib/healerNames';
import { stripCategoryPrefix } from '../../../../lib/specializationLabel';

export default function HealerDirectoryPage() {
  const { categoryId } = useParams();
  const [category, setCategory] = useState(null);
  const [healers, setHealers] = useState([]);

  useEffect(() => {
    loadCategory();
    loadHealers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  async function loadCategory() {
    const { data } = await supabase.from('categories').select('*').eq('id', categoryId).single();
    setCategory(data);
  }

  async function loadHealers() {
    const { data } = await supabase
      .from('healer_profiles')
      .select('user_id, photo_url, healer_categories!inner(category_id)')
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .eq('healer_categories.category_id', categoryId);

    const namesById = await fetchHealerNames(supabase, (data || []).map((h) => h.user_id));
    setHealers((data || []).map((h) => ({ ...h, profile: namesById[h.user_id] })));
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <AppNav />
      <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-10 overflow-hidden">
        <div className="text-center mb-10 relative z-10">
          <h1 className="font-script text-6xl text-brand-green leading-tight">
            Meet Your Pranic Healers!
          </h1>
          {category && (
            <p className="text-sm text-slate-500 mt-2">{stripCategoryPrefix(category.name)}</p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10 relative z-10">
          {healers.map((h) => (
            <Link key={h.user_id} href={`/patient/healer/${h.user_id}`} className="text-center group">
              <div className="w-28 h-28 mx-auto rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-brand-green transition">
                {h.photo_url ? (
                  <img src={h.photo_url} alt={h.profile?.full_name} className="w-full h-full object-cover" />
                ) : (
                  <HealerAvatarFallback size={112} />
                )}
              </div>
              <p className="mt-3 text-sm font-bold italic uppercase tracking-wide text-brand-green">
                {h.profile?.nickname || h.profile?.full_name}
              </p>
            </Link>
          ))}
          {healers.length === 0 && (
            <p className="col-span-4 text-center text-slate-500 text-sm">
              No healers in this category yet.
            </p>
          )}
        </div>

        <BrandAccent />
      </div>
    </div>
  );
}