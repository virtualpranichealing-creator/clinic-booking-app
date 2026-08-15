'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../../lib/supabaseClient';

// A customizable "healing journey" summary for one patient - profile
// details plus every booking, in chronological order, with that session's
// feedback and the healer's session notes merged in underneath it (session
// notes carry a booking_id, so they can be matched precisely rather than
// just listed separately). Admin can toggle which sections to include and
// export as CSV (for spreadsheets) or print/save as PDF - no new PDF
// library needed, the print button just calls window.print() and the
// print:hidden utility classes hide anything that shouldn't end up in the
// saved PDF.
export default function PatientHealingJourneyReport() {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [feedbackByBooking, setFeedbackByBooking] = useState({});
  const [notesByBooking, setNotesByBooking] = useState({});
  const [loading, setLoading] = useState(true);

  const [sections, setSections] = useState({
    details: true,
    bookings: true,
    feedback: true,
    notes: true,
  });

  function toggleSection(key) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function loadReport() {
    setLoading(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', patientId)
      .single();
    setPatient(profileData);

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, slots(start_time, slot_types(label)), healer_profiles(profiles(full_name, nickname))')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });
    setBookings(bookingsData || []);

    const { data: feedbackData } = await supabase
      .from('session_feedback')
      .select('id, booking_id, star_rating, pain_scale, symptoms_improved_pct, experience_text, promotional_consent')
      .eq('patient_id', patientId);
    setFeedbackByBooking(Object.fromEntries((feedbackData || []).map((f) => [f.booking_id, f])));

    const { data: notesData } = await supabase
      .from('session_notes')
      .select('*, observation_items(*, chakras(label))')
      .eq('patient_id', patientId);
    setNotesByBooking(Object.fromEntries((notesData || []).map((n) => [n.booking_id, n])));

    setLoading(false);
  }

  function fileBaseName() {
    return (patient?.nickname || patient?.full_name || 'patient').trim().replace(/\s+/g, '-').toLowerCase();
  }

  function downloadCSV() {
    const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [];

    if (sections.details) {
      lines.push('Patient Healing Journey Summary');
      lines.push(`Full name,${escapeCell(patient?.full_name)}`);
      lines.push(`Nickname,${escapeCell(patient?.nickname)}`);
      lines.push(`Age,${escapeCell(patient?.age)}`);
      lines.push(`Gender,${escapeCell(patient?.gender)}`);
      lines.push(`Mobile,${escapeCell(patient?.mobile)}`);
      lines.push(`Email,${escapeCell(patient?.email)}`);
      lines.push(`Main concern,${escapeCell(patient?.reason_for_healing)}`);
      lines.push(`Joined,${escapeCell(patient?.created_at ? new Date(patient.created_at).toLocaleDateString() : '')}`);
      lines.push(`Total sessions,${bookings.length}`);
      lines.push('');
    }

    if (sections.bookings) {
      const headers = ['Session #', 'Date', 'Session type', 'Healer', 'Status'];
      if (sections.feedback) headers.push('Rating (of 5)', 'Pain (0-10)', 'Improved %', 'Testimonial');
      if (sections.notes) headers.push('Session notes summary', 'Observations');
      lines.push(headers.map(escapeCell).join(','));

      bookings.forEach((b, i) => {
        const fb = feedbackByBooking[b.id];
        const note = notesByBooking[b.id];
        const row = [
          i + 1,
          b.slots?.start_time ? new Date(b.slots.start_time).toLocaleString() : '',
          b.slots?.slot_types?.label || '',
          b.healer_profiles?.profiles?.nickname || b.healer_profiles?.profiles?.full_name || '',
          b.status,
        ];
        if (sections.feedback) {
          row.push(fb?.star_rating ?? '', fb?.pain_scale ?? '', fb?.symptoms_improved_pct ?? '', fb?.experience_text ?? '');
        }
        if (sections.notes) {
          row.push(
            note?.summary ?? '',
            (note?.observation_items || [])
              .map((item) => `${item.chakras?.label || item.body_part}: ${item.status}${item.notes ? ' - ' + item.notes : ''}`)
              .join(' | ')
          );
        }
        lines.push(row.map(escapeCell).join(','));
      });
    }

    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBaseName()}-healing-journey.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="max-w-3xl mx-auto p-8 text-sm text-slate-500">Loading report…</p>;
  }

  const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto p-8 print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <a href={`/admin/patients/${patientId}`} className="text-sm text-brand-green hover:underline">
          ← Back to patient record
        </a>
        <div className="flex gap-2">
          <button onClick={downloadCSV} className="btn-secondary btn-sm">
            ⬇️ Download CSV
          </button>
          <button onClick={() => window.print()} className="btn-primary btn-sm">
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="brand-card-tight mb-8 print:hidden">
        <p className="text-xs font-semibold text-slate-500 mb-2">Customize report — choose what to include</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={sections.details} onChange={() => toggleSection('details')} />
            Patient details
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={sections.bookings} onChange={() => toggleSection('bookings')} />
            Session timeline
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={sections.feedback}
              disabled={!sections.bookings}
              onChange={() => toggleSection('feedback')}
            />
            Feedback (ratings, pain, testimonials)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={sections.notes}
              disabled={!sections.bookings}
              onChange={() => toggleSection('notes')}
            />
            Healer's session notes
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6 border-b border-slate-200 pb-6">
        <img src="/project-hope-logo.png" alt="Project HOPE" className="h-14" />
        <div>
          <h1 className="text-xl font-display font-bold text-brand-green">Healing Journey Report</h1>
          <p className="text-sm text-slate-500">Generated {generatedOn}</p>
        </div>
      </div>

      {sections.details && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wide text-brand-green/80 mb-2">Patient details</h2>
          <dl className="text-sm grid grid-cols-2 gap-x-6 gap-y-1.5 text-brand-ink">
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Full name</dt>
              <dd>{patient?.full_name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Nickname</dt>
              <dd>{patient?.nickname || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Age</dt>
              <dd>{patient?.age || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Gender</dt>
              <dd className="capitalize">{patient?.gender?.replace(/_/g, ' ') || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Mobile</dt>
              <dd>{patient?.mobile || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Email</dt>
              <dd>{patient?.email || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1 col-span-2">
              <dt className="text-slate-500">Main concern</dt>
              <dd className="text-right">{patient?.reason_for_healing || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Joined</dt>
              <dd>{patient?.created_at ? new Date(patient.created_at).toLocaleDateString() : '—'}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Total sessions</dt>
              <dd>{bookings.length}</dd>
            </div>
          </dl>
        </section>
      )}

      {sections.bookings && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-brand-green/80 mb-3">Session timeline</h2>
          {bookings.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No sessions on record yet.</p>
          ) : (
            <div className="space-y-5">
              {bookings.map((b, i) => {
                const fb = feedbackByBooking[b.id];
                const note = notesByBooking[b.id];
                return (
                  <div key={b.id} className="border border-slate-200 rounded-xl p-4 break-inside-avoid">
                    <div className="flex flex-wrap justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-brand-ink">
                        Session {i + 1} — {b.slots?.slot_types?.label}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{b.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      {b.slots?.start_time ? new Date(b.slots.start_time).toLocaleString() : '—'} · with{' '}
                      {b.healer_profiles?.profiles?.nickname || b.healer_profiles?.profiles?.full_name || 'a healer'}
                    </p>

                    {sections.feedback && fb && (
                      <div className="bg-brand-mintSoft rounded-lg px-3 py-2 text-xs space-y-1 mb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-600">
                            {'★'.repeat(fb.star_rating)}
                            {'☆'.repeat(5 - fb.star_rating)}
                          </span>
                          <span className="text-slate-600">
                            Pain {fb.pain_scale}/10 · {fb.symptoms_improved_pct}% improved
                          </span>
                        </div>
                        {fb.experience_text && <p className="text-slate-700 italic">"{fb.experience_text}"</p>}
                      </div>
                    )}

                    {sections.notes && note && (
                      <div className="border-t border-slate-100 pt-2 text-xs space-y-1">
                        <p className="font-medium text-slate-600">Healer's session notes</p>
                        {note.summary && <p className="text-slate-700">{note.summary}</p>}
                        {note.observation_items?.length > 0 && (
                          <ul className="text-slate-600 space-y-0.5">
                            {note.observation_items.map((item) => (
                              <li key={item.id}>
                                {item.chakras?.label || item.body_part}:{' '}
                                <span className="capitalize">{item.status}</span>
                                {item.notes ? ` — ${item.notes}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {!(sections.feedback && fb) && !(sections.notes && note) && (
                      <p className="text-xs text-slate-400 italic">No feedback or session notes recorded yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
