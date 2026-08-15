'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';
import BrandAccent from '../../../components/BrandAccent';
import { stripCategoryPrefix } from '../../../lib/specializationLabel';

export default function FindHealerPage() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <AppNav />
      <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-10 overflow-hidden">
        <div className="text-center mb-8 relative z-10">
          <h1 className="font-script text-6xl text-brand-green leading-tight">
            Find a Pranic Healer
          </h1>
          <p className="font-script text-2xl text-brand-greenLight mt-1">Pranic Healing for:</p>
          <Link
            href="/patient/healers"
            className="inline-block mt-3 text-xs font-medium text-brand-green underline underline-offset-2"
          >
            Or browse every healer's profile at once →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/patient/find-healer/${c.id}`}
              className="bg-brand-green hover:opacity-90 transition-colors text-white font-bold text-center rounded-full py-5 px-6 shadow-sm"
            >
              {stripCategoryPrefix(c.name)}
            </Link>
          ))}
          {categories.length === 0 && (
            <p className="text-slate-500 text-sm col-span-2 text-center">
              No categories set up yet.
            </p>
          )}
        </div>

        <BrandAccent />
      </div>
    </div>
  );
}