'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import AppNav from '../../../../components/AppNav';
import DrawingCanvas from '../../../../components/DrawingCanvas';

const STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'overactivated', label: 'Overactivated' },
  { value: 'underactivated', label: 'Underactivated' },
  { value: 'congested', label: 'Congested' },
  { value: 'depleted', label: 'Depleted' },
];

export default function AdminPatientDetailPage() {
  const { patientId } = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referredBy, setReferredBy] = useState('');
  const [savingReferral, setSavingReferral] = useState(false);
  const [feedbackByBooking, setFeedbackByBooking] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Interactive preview of the healer's note-taking form - fully usable
  // (draw, pick chakra statuses, type a summary) so admin can see exactly
  // what a healer experiences, but never actually saves anything.
  const [showNotePreview, setShowNotePreview] = useState(false);
  const [previewChakras, setPreviewChakras] = useState([]);
  const [previewChakraTags, setPreviewChakraTags] = useState({});
  const [previewSummary, setPreviewSummary] = useState('');
  const [previewDrawingData, setPreviewDrawingData] = useState(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function loadAll() {
    setLoading(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', patientId)
      .single();
    setPatient(profileData);
    setReferredBy(profileData?.referred_by_name || '');

    if (profileData?.avatar_url) {
      const { data: signed } = await supabase.storage
        .from('patient-photos')
        .createSignedUrl(profileData.avatar_url, 3600);
      if (signed) setPhotoUrl(signed.signedUrl);
    }

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(
        '*, slots(start_time, slot_types(label)), healer_profiles(profiles(full_name, nickname))'
      )
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setBookings(bookingsData || []);

    // Feedback is admin-visible for oversight/quality purposes, but the
    // patient's private_note_to_healer field is deliberately not selected
    // here - that one stays between the patient and their healer only.
    const { data: feedbackData } = await supabase
      .from('session_feedback')
      .select('id, booking_id, star_rating, pain_scale, symptoms_improved_pct, experience_text, promotional_consent')
      .eq('patient_id', patientId);
    setFeedbackByBooking(Object.fromEntries((feedbackData || []).map((f) => [f.booking_id, f])));

    const { data: notesData } = await supabase
      .from('session_notes')
      .select(
        '*, healer_profiles(profiles(full_name, nickname)), observation_items(*, chakras(label))'
      )
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setNotes(notesData || []);

    setLoading(false);
  }

  async function copyFeedbackLink(bookingId) {
    const url = `${window.location.origin}/patient/feedback/${bookingId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(bookingId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function saveReferral() {
    setSavingReferral(true);
    await supabase
      .from('profiles')
      .update({ referred_by_name: referredBy || null })
      .eq('id', patientId);
    setSavingReferral(false);
  }

  if (loading) {
    return (
      <div className="brand-page">
        <AppNav />
        <p className="text-slate-400 text-sm">Loading patient record…</p>
      </div>
    );
  }

  return (
    <div className="brand-page space-y-6">
      <AppNav />

      <button
        onClick={() => router.push('/admin')}
        className="text-sm text-brand-green hover:underline flex items-center gap-1"
      >
        ← Back to admin dashboard
      </button>

      {/* Header card */}
      <div className="brand-shell">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start relative z-10">
          <div className="w-28 h-28 rounded-full overflow-hidden shrink-0 bg-brand-mint flex items-center justify-center text-3xl font-script text-brand-green">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (patient?.nickname || patient?.full_name || '?').charAt(0)
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="font-script text-4xl text-brand-green">{patient?.full_name}</h1>
              {patient?.nickname && (
                <span className="text-sm text-slate-500 italic">"{patient.nickname}"</span>
              )}
            </div>
            <span
              className={
                patient?.patient_status === 'active' ? 'pill-available' : 'pill-neutral'
              }
            >
              {patient?.patient_status || 'active'}
            </span>
            {patient?.reason_for_healing && (
              <p className="text-sm text-slate-600 mt-3">
                <span className="font-semibold text-brand-ink">Main concern: </span>
                {patient.reason_for_healing}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Referral - used for the 6% referral line in the payout split */}
      <div className="brand-card">
        <p className="brand-section-title mb-2">Referred by (for payout split)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={referredBy}
            onChange={(e) => setReferredBy(e.target.value)}
            placeholder="Name of who referred this patient (optional)"
            className="brand-input"
          />
          <button onClick={saveReferral} disabled={savingReferral} className="btn-primary btn-sm shrink-0">
            {savingReferral ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Intake details */}
      <div className="brand-card">
        <p className="brand-section-title mb-2">Saved intake details</p>
        <dl className="text-sm space-y-1.5 text-brand-ink">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Full name</dt>
            <dd>
              {[patient?.first_name, patient?.last_name].filter(Boolean).join(' ') ||
                patient?.full_name ||
                '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Age</dt>
            <dd>{patient?.age || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Gender</dt>
            <dd className="capitalize">{patient?.gender || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Mobile</dt>
            <dd>{patient?.mobile || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Email</dt>
            <dd>{patient?.email || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Delivery preference</dt>
            <dd className="capitalize">{patient?.delivery_preference?.replace('_', ' ') || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Consent form</dt>
            <dd>
              {patient?.consent_agreed
                ? `✅ Agreed${patient.consent_agreed_at ? ' on ' + new Date(patient.consent_agreed_at).toLocaleDateString() : ''}`
                : 'Not yet agreed'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Joined</dt>
            <dd>{patient?.created_at ? new Date(patient.created_at).toLocaleDateString() : '—'}</dd>
          </div>
        </dl>
      </div>

      {/* Booking history across every healer */}
      <div className="brand-card">
        <p className="brand-section-title mb-3">Booking history ({bookings.length})</p>
        {bookings.length === 0 ? (
          <p className="brand-empty">No bookings on record yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {bookings.map((b) => {
              const fb = feedbackByBooking[b.id];
              return (
                <li
                  key={b.id}
                  className="text-sm border border-slate-200 rounded-xl px-4 py-2.5 space-y-1.5"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-brand-ink">
                      {b.slots?.slot_types?.label} with{' '}
                      {b.healer_profiles?.profiles?.nickname || b.healer_profiles?.profiles?.full_name} —{' '}
                      {new Date(b.slots?.start_time).toLocaleString()}
                    </span>
                    <span
                      className={
                        b.status === 'booked'
                          ? 'pill-booked'
                          : b.status === 'reserved'
                          ? 'pill-reserved'
                          : 'pill-neutral'
                      }
                    >
                      {b.status}
                    </span>
                  </div>

                  {fb ? (
                    <div className="bg-brand-mintSoft rounded-lg px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-500">
                          {'★'.repeat(fb.star_rating)}
                          {'☆'.repeat(5 - fb.star_rating)}
                        </span>
                        <span className="text-slate-500">
                          Pain {fb.pain_scale}/10 · {fb.symptoms_improved_pct}% improved
                          {fb.promotional_consent ? ' · public OK' : ''}
                        </span>
                      </div>
                      {fb.experience_text && <p className="text-slate-700">"{fb.experience_text}"</p>}
                    </div>
                  ) : (
                    b.status === 'completed' && (
                      <p className="text-xs text-slate-400">No feedback submitted yet.</p>
                    )
                  )}

                  {b.status === 'completed' && (
                    <div className="flex items-center gap-3">
                      <a
                        href={`/patient/feedback/${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-green underline underline-offset-2"
                      >
                        View feedback page ↗
                      </a>
                      <button
                        onClick={() => copyFeedbackLink(b.id)}
                        className="text-xs text-brand-green underline underline-offset-2"
                      >
                        {copiedId === b.id ? '✓ Link copied' : 'Copy feedback link'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Session notes / chakra observations, read-only for admin */}
      <div className="brand-card">
        <p className="brand-section-title mb-3">Session notes &amp; observations ({notes.length})</p>
        {notes.length === 0 ? (
          <p className="brand-empty">No session notes recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="border border-slate-200 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{new Date(note.created_at).toLocaleString()}</span>
                  <span>
                    {note.healer_profiles?.profiles?.nickname || note.healer_profiles?.profiles?.full_name}
                  </span>
                </div>
                {note.summary && <p className="text-brand-ink">{note.summary}</p>}
                {note.observation_items?.length > 0 && (
                  <ul className="text-xs text-slate-600 space-y-0.5">
                    {note.observation_items.map((item) => (
                      <li key={item.id}>
                        {item.chakras?.label || item.chakra_id}:{' '}
                        <span className="capitalize">{item.status}</span>
                        {item.notes ? ` — ${item.notes}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {note.drawing_data && (
                  <img src={note.drawing_data} alt="Body diagram" className="max-w-xs border rounded-lg" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
