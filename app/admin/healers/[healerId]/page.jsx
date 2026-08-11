'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import AppNav from '../../../../components/AppNav';
import HealerAvatarFallback from '../../../../components/HealerAvatarFallback';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminHealerDetailPage() {
  const { healerId } = useParams();
  const router = useRouter();
  const [healer, setHealer] = useState(null);
  const [categories, setCategories] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [privateDetails, setPrivateDetails] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healerId]);

  async function loadAll() {
    setLoading(true);

    const { data: healerData } = await supabase
      .from('healer_profiles')
      .select('*, profiles!inner(full_name, nickname, email, mobile, created_at)')
      .eq('user_id', healerId)
      .single();
    setHealer(healerData);

    const { data: cats } = await supabase
      .from('healer_categories')
      .select('categories(name)')
      .eq('healer_id', healerId);
    setCategories((cats || []).map((c) => c.categories?.name).filter(Boolean));

    const { data: specs } = await supabase
      .from('healer_specializations')
      .select('specializations(label, display_order)')
      .eq('healer_id', healerId);
    setSpecializations(
      (specs || []).map((s) => s.specializations).filter(Boolean).sort((a, b) => a.display_order - b.display_order)
    );

    const { data: avail } = await supabase
      .from('availability_rules')
      .select('day_of_week, start_time, end_time, slot_types(label)')
      .eq('healer_id', healerId)
      .order('day_of_week');
    setAvailability(avail || []);

    const { data: priv } = await supabase
      .from('healer_private_details')
      .select('*')
      .eq('user_id', healerId)
      .maybeSingle();
    setPrivateDetails(priv);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('patient_id, status, created_at, profiles!bookings_patient_id_fkey(full_name, nickname, reason_for_healing, avatar_url)')
      .eq('healer_id', healerId)
      .in('status', ['booked', 'completed', 'no_show'])
      .order('created_at', { ascending: false });

    const seen = new Map();
    for (const b of bookings || []) {
      if (!seen.has(b.patient_id)) seen.set(b.patient_id, b);
    }
    setPatients(Array.from(seen.values()));

    setLoading(false);
  }

  async function setApproval(status) {
    await supabase.from('healer_profiles').update({ approval_status: status }).eq('user_id', healerId);
    loadAll();
  }

  async function toggleActive() {
    await supabase
      .from('healer_profiles')
      .update({ is_active: !healer.is_active })
      .eq('user_id', healerId);
    loadAll();
  }

  if (loading) {
    return (
      <div className="brand-page">
        <AppNav />
        <p className="text-slate-400 text-sm">Loading healer profile…</p>
      </div>
    );
  }

  return (
    <div className="brand-page-wide space-y-6">
      <AppNav />

      <button
        onClick={() => router.push('/admin')}
        className="text-sm text-brand-green hover:underline flex items-center gap-1"
      >
        ← Back to admin dashboard
      </button>

      {/* Header card */}
      <div className="brand-shell">
        <div className="flex flex-col sm:flex-row gap-6 relative z-10">
          <div className="w-32 h-32 rounded-full overflow-hidden shrink-0 mx-auto sm:mx-0">
            {healer?.photo_url ? (
              <img src={healer.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <HealerAvatarFallback size={128} />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="font-script text-4xl text-brand-green">{healer?.profiles?.full_name}</h1>
              {healer?.profiles?.nickname && (
                <span className="text-sm text-slate-500 italic">"{healer.profiles.nickname}"</span>
              )}
            </div>
            {healer?.title && <p className="text-sm font-medium text-brand-greenDark">{healer.title}</p>}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
              <span
                className={
                  healer?.approval_status === 'approved'
                    ? 'pill-available'
                    : healer?.approval_status === 'rejected'
                    ? 'pill-booked'
                    : 'pill-reserved'
                }
              >
                {healer?.approval_status}
              </span>
              <span className={healer?.is_active ? 'pill-available' : 'pill-neutral'}>
                {healer?.is_active ? 'Active' : 'Inactive'}
              </span>
              {healer?.onsite_available && <span className="pill-onsite">📍 Onsite available</span>}
            </div>

            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
              {healer?.approval_status !== 'approved' && (
                <button onClick={() => setApproval('approved')} className="btn-primary btn-sm">
                  Approve
                </button>
              )}
              {healer?.approval_status !== 'rejected' && (
                <button onClick={() => setApproval('rejected')} className="btn-danger-ghost btn-sm">
                  Reject
                </button>
              )}
              <button onClick={toggleActive} className="btn-secondary btn-sm">
                {healer?.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <a
                href={`/patient/healer/${healerId}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost btn-sm"
              >
                👁️ View public profile
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Contact + admin-only private details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="brand-card">
          <p className="brand-section-title">Contact</p>
          <dl className="text-sm space-y-1.5 text-brand-ink">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Email</dt>
              <dd>{healer?.profiles?.email || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Phone</dt>
              <dd>{healer?.profiles?.mobile || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Location</dt>
              <dd>{healer?.location || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Joined</dt>
              <dd>
                {healer?.profiles?.created_at
                  ? new Date(healer.profiles.created_at).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="brand-card">
          <p className="brand-section-title">Payout details (admin only)</p>
          {privateDetails ? (
            <dl className="text-sm space-y-1.5 text-brand-ink">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Bank</dt>
                <dd>{privateDetails.bank_name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Account name</dt>
                <dd>{privateDetails.bank_account_name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Account number</dt>
                <dd>{privateDetails.bank_account_number || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Healer agreement</dt>
                <dd>{privateDetails.agreement_accepted ? '✅ Accepted' : 'Not yet accepted'}</dd>
              </div>
            </dl>
          ) : (
            <p className="brand-empty">No payout details on file yet.</p>
          )}
        </div>
      </div>

      {/* Everything the healer filled out on their public profile */}
      <div className="brand-card space-y-4">
        <p className="brand-section-title">Profile details</p>

        {healer?.specialty_summary && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Specialty summary</p>
            <p className="text-sm text-brand-ink">{healer.specialty_summary}</p>
          </div>
        )}
        {healer?.credentials && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Credentials</p>
            <p className="text-sm text-brand-ink whitespace-pre-line italic">{healer.credentials}</p>
          </div>
        )}
        {healer?.bio && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Bio</p>
            <p className="text-sm text-brand-ink whitespace-pre-line">{healer.bio}</p>
          </div>
        )}
        {healer?.specializes_in && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Specializes in (free text)</p>
            <p className="text-sm text-brand-ink whitespace-pre-line">{healer.specializes_in}</p>
          </div>
        )}
        {healer?.additional_notes && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Additional notes</p>
            <p className="text-sm text-brand-ink whitespace-pre-line italic">{healer.additional_notes}</p>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <span key={c} className="pill-neutral">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {specializations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Specializations</p>
            <div className="flex flex-wrap gap-1.5">
              {specializations.map((s, i) => (
                <span key={i} className="pill-neutral">
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {availability.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Weekly availability</p>
            <ul className="text-sm text-brand-ink space-y-0.5">
              {availability.map((r, i) => (
                <li key={i}>
                  {DAYS[r.day_of_week]} {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)} —{' '}
                  {r.slot_types?.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* This healer's patients */}
      <div className="brand-card">
        <p className="brand-section-title mb-3">Patients ({patients.length})</p>
        {patients.length === 0 ? (
          <p className="brand-empty">No patients with a booked session yet.</p>
        ) : (
          <ul className="space-y-2">
            {patients.map((p) => (
              <li key={p.patient_id}>
                <Link
                  href={`/admin/patients/${p.patient_id}`}
                  className="flex items-center justify-between text-sm border border-slate-200 rounded-xl px-4 py-2.5 hover:border-brand-green/40 hover:bg-brand-mintSoft transition-colors"
                >
                  <span className="text-brand-ink font-medium">
                    {p.profiles?.nickname || p.profiles?.full_name}
                  </span>
                  <span className="text-slate-400 text-xs">View patient →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
