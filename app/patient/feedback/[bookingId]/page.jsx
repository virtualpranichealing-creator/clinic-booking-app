'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import AppNav from '../../../../components/AppNav';

const IMPROVEMENT_OPTIONS = [10, 25, 50, 75, 90, 100];

const CONFIDENTIALITY_TEXT =
  'I understand this testimonial shall be kept confidential. The protected information provided will be dealt with sensitivity and in strict confidence, and may be disclosed or used for therapy and quality improvement. I consent to the collection and use of these information for my Pranic Healing Treatment, Administrative needs and for Certification of the assigned Pranic Healer.';

const PROMOTIONAL_TEXT =
  'By sharing my testimonial, I voluntarily give permission for my experience with Pranic Healing to be used for inspirational and promotional purposes, including but not limited to social media, presentations, websites, emails, and informational materials. I understand that my personal identity will remain confidential and will not be publicly disclosed without my consent. My full name will not be used. If applicable, my testimonial may be attributed only using my initials (e.g., "M.A.") or remain anonymous to protect my privacy. The purpose of sharing these testimonials is to inspire and encourage others to experience the potential benefits and gift of Pranic Healing.';

export default function LeaveFeedbackPage() {
  const { bookingId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const [starRating, setStarRating] = useState(0);
  const [painScale, setPainScale] = useState(0);
  const [improvedPct, setImprovedPct] = useState(null);
  const [experienceText, setExperienceText] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [confidentialityConsent, setConfidentialityConsent] = useState(false);
  const [promotionalConsent, setPromotionalConsent] = useState(false);

  useEffect(() => {
    loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function loadBooking() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, patient_id, healer_id, status, slots(start_time, slot_types(label))')
      .eq('id', bookingId)
      .single();

    setBooking(bookingData);

    const { data: existing } = await supabase
      .from('session_feedback')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    setAlreadySubmitted(!!existing);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (starRating === 0) return setError('Please give a star rating.');
    if (improvedPct === null) return setError('Please select how much your symptoms improved.');
    if (!confidentialityConsent) return setError('Please agree to the confidentiality agreement to submit.');

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('session_feedback').insert({
      booking_id: booking.id,
      patient_id: booking.patient_id,
      healer_id: booking.healer_id,
      star_rating: starRating,
      pain_scale: painScale,
      symptoms_improved_pct: improvedPct,
      experience_text: experienceText || null,
      private_note_to_healer: privateNote || null,
      private_note: privateNote || null,
      confidentiality_consent: confidentialityConsent,
      promotional_consent: promotionalConsent,
    });

    if (insertError) {
      setError('Could not submit your feedback. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setDone(true);
  }

  if (loading) {
    return (
      <div className="brand-page">
        <AppNav />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (!booking || booking.status !== 'completed') {
    return (
      <div className="brand-page space-y-4">
        <AppNav />
        <p className="brand-empty">
          Feedback can only be submitted for a session that's been marked completed.
        </p>
      </div>
    );
  }

  if (alreadySubmitted || done) {
    return (
      <div className="brand-page space-y-4">
        <AppNav />
        <div className="brand-shell text-center py-12">
          <p className="text-4xl mb-3">🙏</p>
          <h1 className="text-xl font-display font-bold text-brand-green mb-2">
            {done ? 'Thank you for your feedback!' : "You've already shared feedback for this session"}
          </h1>
          <p className="text-sm text-slate-500 mb-5">
            {done
              ? "We're grateful you took the time to share your experience."
              : 'Thank you for helping us improve.'}
          </p>
          <button onClick={() => router.push('/patient')} className="btn-primary">
            Back to bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-page space-y-6">
      <AppNav />

      <div>
        <h1 className="text-2xl font-display font-bold text-brand-green">How was your session?</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {booking.slots?.slot_types?.label} —{' '}
          {booking.slots?.start_time && new Date(booking.slots.start_time).toLocaleDateString()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="brand-card space-y-6 max-w-lg">
        <div>
          <label className="brand-label mb-2">Overall, how would you rate this session?</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStarRating(n)}
                className={`text-3xl transition-transform hover:scale-110 ${n <= starRating ? 'text-amber-400' : 'text-slate-200'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="brand-label mb-2">
            Pain level right now — 0 (no pain) to 10 (worst possible pain)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPainScale(n)}
                className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors ${
                  painScale === n
                    ? 'bg-brand-green text-white border-brand-green'
                    : 'border-slate-200 text-slate-500 hover:border-brand-green/40'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="brand-label mb-2">How much have your symptoms improved?</label>
          <div className="flex flex-wrap gap-2">
            {IMPROVEMENT_OPTIONS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setImprovedPct(pct)}
                className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                  improvedPct === pct
                    ? 'bg-brand-green text-white border-brand-green'
                    : 'border-slate-200 text-slate-600 hover:border-brand-green/40'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="brand-label">
            How was your overall experience with today's healing session?
          </label>
          <p className="text-[11px] text-slate-400 mb-1.5">
            This may be shared as an anonymous testimonial only if you check the box below to allow it.
          </p>
          <textarea
            value={experienceText}
            onChange={(e) => setExperienceText(e.target.value)}
            rows={4}
            placeholder="Share as much or as little as you'd like…"
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="border-t border-slate-100 pt-5">
          <label className="brand-label">Anything you'd like to tell your healer privately?</label>
          <p className="text-[11px] text-slate-400 mb-1.5">
            🔒 This note is private — only your healer will see it. It will never be shown publicly
            or shared as a testimonial.
          </p>
          <textarea
            value={privateNote}
            onChange={(e) => setPrivateNote(e.target.value)}
            rows={3}
            placeholder="Optional — anything specific for your healer only…"
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none"
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-slate-500 bg-brand-mintSoft rounded-xl p-3">
          <input
            type="checkbox"
            checked={confidentialityConsent}
            onChange={(e) => setConfidentialityConsent(e.target.checked)}
            className="mt-0.5"
            required
          />
          <span>{CONFIDENTIALITY_TEXT}</span>
        </label>

        <label className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
          <input
            type="checkbox"
            checked={promotionalConsent}
            onChange={(e) => setPromotionalConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>{PROMOTIONAL_TEXT}</span>
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Submitting…' : 'Submit feedback'}
        </button>
      </form>
    </div>
  );
}
