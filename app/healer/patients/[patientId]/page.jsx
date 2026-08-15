'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

export default function HealerPatientDetailPage() {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [bookingsWithPatient, setBookingsWithPatient] = useState([]);
  const [pastNotes, setPastNotes] = useState([]);
  const [patientFeedback, setPatientFeedback] = useState([]);
  const [chakras, setChakras] = useState([]);

  // New observation form state
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [summary, setSummary] = useState('');
  const [drawingData, setDrawingData] = useState(null);
  const [chakraTags, setChakraTags] = useState({}); // { chakra_id: { status, notes } }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPatient();
    loadBookingsWithPatient();
    loadPastNotes();
    loadFeedback();
    loadChakras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function loadPatient() {
    const { data } = await supabase.from('profiles').select('*').eq('id', patientId).single();
    setPatient(data);
    if (data?.avatar_url) {
      const { data: signed } = await supabase.storage
        .from('patient-photos')
        .createSignedUrl(data.avatar_url, 3600);
      if (signed) setPhotoUrl(signed.signedUrl);
    }
  }

  async function loadBookingsWithPatient() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, slots(start_time, slot_types(label))')
      .eq('healer_id', user.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setBookingsWithPatient(data || []);
  }

  async function loadPastNotes() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('session_notes')
      .select('*, bookings(slots(start_time)), observation_items(*, chakras(label))')
      .eq('healer_id', user.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setPastNotes(data || []);
  }

  async function loadFeedback() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('session_feedback')
      .select('*, bookings(slots(start_time))')
      .eq('healer_id', user.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setPatientFeedback(data || []);
  }

  async function loadChakras() {
    const { data } = await supabase.from('chakras').select('*').order('display_order');
    setChakras(data || []);
  }

  function updateChakraTag(chakraId, field, value) {
    setChakraTags((prev) => ({
      ...prev,
      [chakraId]: { ...prev[chakraId], [field]: value },
    }));
  }

  async function saveObservation() {
    if (!selectedBookingId) {
      window.alert('Please select which session this observation is for.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: newNote, error } = await supabase
      .from('session_notes')
      .insert({
        booking_id: selectedBookingId,
        healer_id: user.id,
        patient_id: patientId,
        summary,
        drawing_data: drawingData,
      })
      .select()
      .single();

    if (error) {
      window.alert('Could not save the observation. Please try again.');
      setSaving(false);
      return;
    }

    const items = Object.entries(chakraTags)
      .filter(([, val]) => val?.status || val?.notes)
      .map(([chakraId, val]) => ({
        session_note_id: newNote.id,
        chakra_id: chakraId,
        body_part: chakraId,
        status: val.status || 'overactivated', // required not-null; default if only notes given
        notes: val.notes || null,
      }));

    if (items.length > 0) {
      await supabase.from('observation_items').insert(items);
    }

    setSaving(false);
    setSummary('');
    setChakraTags({});
    setSelectedBookingId('');
    loadPastNotes();
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <AppNav />

      <div className="flex items-center gap-4">
        {photoUrl && (
          <img src={photoUrl} alt={patient?.full_name} className="w-16 h-16 rounded-full object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{patient?.full_name}</h1>
          {patient?.reason_for_healing && (
            <p className="text-slate-500 text-sm mt-1">
              Main concern: {patient.reason_for_healing}
            </p>
          )}
        </div>
      </div>

      {/* Session history */}
      <section>
        <h2 className="text-lg font-medium mb-3">Session history with this patient</h2>
        <ul className="space-y-1 text-sm">
          {bookingsWithPatient.map((b) => (
            <li key={b.id} className="border rounded px-3 py-2 flex justify-between">
              <span>
                {b.slots?.slot_types?.label} — {new Date(b.slots?.start_time).toLocaleString()}
              </span>
              <span className="capitalize text-slate-500">{b.status}</span>
            </li>
          ))}
          {bookingsWithPatient.length === 0 && (
            <p className="text-slate-500">No sessions on record yet.</p>
          )}
        </ul>
      </section>

      {/* New observation */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-medium">New chakra observation</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Which session is this for?</label>
          <select
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 w-full"
          >
            <option value="">Select a session…</option>
            {bookingsWithPatient.map((b) => (
              <option key={b.id} value={b.id}>
                {b.slots?.slot_types?.label} — {new Date(b.slots?.start_time).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Body diagram (draw or annotate)</label>
          <DrawingCanvas onChange={setDrawingData} />
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Chakra tags</h3>
          <div className="space-y-2">
            {chakras.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
                <span className="w-40 text-sm">{c.label}</span>
                <select
                  value={chakraTags[c.id]?.status || ''}
                  onChange={(e) => updateChakraTag(c.id, 'status', e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-base"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={chakraTags[c.id]?.notes || ''}
                  onChange={(e) => updateChakraTag(c.id, 'notes', e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-base flex-1 min-w-[150px]"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Overall summary (this will be visible to the patient)
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded px-3 py-2 text-base"
            placeholder="e.g. Overall energy improving, continue distant healing twice a week..."
          />
        </div>

        <button
          onClick={saveObservation}
          disabled={saving}
          className="bg-slate-800 text-white rounded px-4 py-2 text-sm"
        >
          {saving ? 'Saving…' : 'Save observation'}
        </button>
      </section>

      {/* Patient feedback - includes their private note, visible only here */}
      <section>
        <h2 className="text-lg font-medium mb-3">Patient Feedback</h2>
        <div className="space-y-3">
          {patientFeedback.length === 0 && (
            <p className="text-sm text-slate-500">No feedback submitted yet.</p>
          )}
          {patientFeedback.map((fb) => (
            <div key={fb.id} className="border rounded-lg p-4 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-amber-400">
                  {'★'.repeat(fb.star_rating)}
                  {'☆'.repeat(5 - fb.star_rating)}
                </span>
                <span className="text-slate-400 text-xs">
                  {fb.bookings?.slots?.start_time && new Date(fb.bookings.slots.start_time).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pain: {fb.pain_scale}/10 · Symptoms improved: {fb.symptoms_improved_pct}%
              </p>
              {fb.experience_text && (
                <p className="text-slate-700">
                  <span className="font-medium text-slate-500">Experience: </span>
                  {fb.experience_text}
                </p>
              )}
              {fb.private_note_to_healer && (
                <p className="bg-brand-mintSoft rounded-lg px-3 py-2">
                  <span className="font-medium text-brand-green">🔒 Private note to you: </span>
                  {fb.private_note_to_healer}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Past observations */}
      <section>
        <h2 className="text-lg font-medium mb-3">Past observations</h2>
        <div className="space-y-3">
          {pastNotes.length === 0 && (
            <p className="text-sm text-slate-500">No observations recorded yet.</p>
          )}
          {pastNotes.map((note) => (
            <div key={note.id} className="border rounded-lg p-4 text-sm space-y-2">
              <p className="text-slate-500">
                {new Date(note.created_at).toLocaleString()}
              </p>
              {note.summary && <p>{note.summary}</p>}
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
                <img src={note.drawing_data} alt="Body diagram" className="max-w-xs border rounded" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
