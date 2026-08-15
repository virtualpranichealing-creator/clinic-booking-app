'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import AppNav from '../../../../components/AppNav';
import BrandAccent from '../../../../components/BrandAccent';
import HealerAvatarFallback from '../../../../components/HealerAvatarFallback';
import { stripSpecializationPrefix } from '../../../../lib/specializationLabel';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HealerPublicProfilePage() {
  const { healerId } = useParams();
  const router = useRouter();
  const [healer, setHealer] = useState(null);
  const [specializations, setSpecializations] = useState([]);
  const [availabilitySummary, setAvailabilitySummary] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({ avg_rating: 0, review_count: 0 });
  const [testimonials, setTestimonials] = useState([]);
  const [viewerRole, setViewerRole] = useState(null);

  useEffect(() => {
    loadHealer();
    loadAvailability();
    loadFeedback();
    loadViewerRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healerId]);

  async function loadViewerRole() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    setViewerRole(data?.role || null);
  }

  async function loadFeedback() {
    const { data: stats } = await supabase.rpc('healer_feedback_stats', { p_healer_id: healerId });
    if (stats && stats[0]) setFeedbackStats(stats[0]);

    const { data: reviews } = await supabase.rpc('healer_testimonials', { p_healer_id: healerId });
    setTestimonials(reviews || []);
  }

  async function loadHealer() {
    const { data } = await supabase
      .from('healer_profiles')
      .select('*')
      .eq('user_id', healerId)
      .single();

    // profiles' RLS is `id = auth.uid()` only, which blocks a patient from
    // reading a healer's own row directly - this narrow public view exposes
    // just the display name for active/approved healers instead.
    const { data: nameData } = await supabase
      .from('healer_public_profiles')
      .select('nickname, full_name')
      .eq('id', healerId)
      .maybeSingle();

    setHealer(data ? { ...data, profiles: nameData } : null);

    const { data: specs } = await supabase
      .from('healer_specializations')
      .select('specializations(label, display_order)')
      .eq('healer_id', healerId);
    setSpecializations(
      (specs || [])
        .map((s) => s.specializations)
        .sort((a, b) => a.display_order - b.display_order)
    );
  }

  async function loadAvailability() {
    const { data } = await supabase
      .from('availability_rules')
      .select('day_of_week, start_time, end_time')
      .eq('healer_id', healerId)
      .order('day_of_week');
    setAvailabilitySummary(data || []);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <AppNav />
      <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-10 overflow-hidden">
        <div className="text-center mb-6 relative z-10">
          <h1 className="font-script text-6xl text-brand-green leading-tight">
            {healer?.profiles?.full_name}
          </h1>
          {healer?.title && (
            <span className="inline-block mt-2 bg-brand-green text-white text-xs font-bold uppercase tracking-wide rounded-full px-4 py-1.5">
              {healer.title}
            </span>
          )}
          {feedbackStats.review_count > 0 && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-sm">
              <span className="text-amber-400">
                {'★'.repeat(Math.round(feedbackStats.avg_rating))}
                {'☆'.repeat(5 - Math.round(feedbackStats.avg_rating))}
              </span>
              <span className="text-slate-500">
                {Number(feedbackStats.avg_rating).toFixed(1)} ({feedbackStats.review_count}{' '}
                review{feedbackStats.review_count === 1 ? '' : 's'})
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="text-center">
            <div className="w-40 h-40 mx-auto rounded-full overflow-hidden">
              {healer?.photo_url ? (
                <img src={healer.photo_url} alt={healer.profiles?.full_name} className="w-full h-full object-cover" />
              ) : (
                <HealerAvatarFallback size={160} />
              )}
            </div>
            {healer?.profiles?.nickname && (
              <p className="mt-3 font-bold italic text-lg text-brand-green">
                "{healer.profiles.nickname}"
              </p>
            )}
            {healer?.location && (
              <p className="text-sm text-slate-500 mt-2">📍 {healer.location}</p>
            )}
            {healer?.onsite_available && (
              <p className="text-xs text-brand-green font-medium mt-2 bg-brand-mint/50 rounded-full px-3 py-1 inline-block">
                📍 Also available onsite at PHFP Ortigas Center (Tue–Fri, 2–5 PM)
              </p>
            )}
            {availabilitySummary.length > 0 && (
              <div className="text-sm text-slate-500 mt-2">
                <p className="font-semibold text-slate-600">Available hours:</p>
                {availabilitySummary.map((r, i) => (
                  <p key={i}>
                    {DAYS[r.day_of_week]} {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 text-brand-ink">
            {healer?.credentials && (
              <div className="italic font-semibold whitespace-pre-line">{healer.credentials}</div>
            )}

            {specializations.length > 0 && (
              <div>
                <p className="font-bold uppercase text-sm tracking-wide">Specializes in</p>
                <p className="text-xs text-slate-400 italic mt-0.5">Pranic Healing for:</p>
                <ul className="list-disc list-inside italic text-sm mt-1">
                  {specializations.map((s, i) => (
                    <li key={i}>{stripSpecializationPrefix(s.label)}</li>
                  ))}
                </ul>
              </div>
            )}

            {healer?.additional_notes && (
              <div className="text-sm italic whitespace-pre-line">{healer.additional_notes}</div>
            )}

            {healer?.bio && <p className="text-sm text-slate-600">{healer.bio}</p>}

            {viewerRole && (
              <button
                onClick={() => router.push(`/patient?healer=${healerId}`)}
                className="bg-brand-green hover:opacity-90 transition-colors text-white font-bold rounded-full px-6 py-3 mt-4"
              >
                Book a Session Here
              </button>
            )}
          </div>
        </div>

        {testimonials.length > 0 && (
          <div className="mt-10 pt-8 border-t border-slate-100 relative z-10">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-green/80 mb-4">
              What patients are saying
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {testimonials.map((t) => (
                <div key={t.id} className="bg-brand-mintSoft rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-amber-400 text-sm">
                      {'★'.repeat(t.star_rating)}
                      {'☆'.repeat(5 - t.star_rating)}
                    </span>
                    <span className="text-xs font-semibold text-brand-green">— {t.patient_initials}</span>
                  </div>
                  {t.experience_text && (
                    <p className="text-sm text-slate-600 italic">"{t.experience_text}"</p>
                  )}
                  {t.symptoms_improved_pct != null && (
                    <p className="text-xs text-slate-400 mt-2">
                      Reported {t.symptoms_improved_pct}% symptom improvement
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <BrandAccent />
      </div>
    </div>
  );
}