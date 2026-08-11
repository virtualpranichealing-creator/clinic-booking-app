'use client';

import { useState } from 'react';

const IMPROVEMENT_OPTIONS = [10, 25, 50, 75, 90, 100];

const CONFIDENTIALITY_TEXT =
  'I understand this testimonial shall be kept confidential. The protected information provided will be dealt with sensitivity and in strict confidence, and may be disclosed or used for therapy and quality improvement. I consent to the collection and use of these information for my Pranic Healing Treatment, Administrative needs and for Certification of the assigned Pranic Healer.';

const PROMOTIONAL_TEXT =
  'By sharing my testimonial, I voluntarily give permission for my experience with Pranic Healing to be used for inspirational and promotional purposes, including but not limited to social media, presentations, websites, emails, and informational materials. I understand that my personal identity will remain confidential and will not be publicly disclosed without my consent. My full name will not be used. If applicable, my testimonial may be attributed only using my initials (e.g., "M.A.") or remain anonymous to protect my privacy. The purpose of sharing these testimonials is to inspire and encourage others to experience the potential benefits and gift of Pranic Healing.';

// Mirrors the real form at app/patient/feedback/[bookingId]/page.jsx, so
// admin can see and interact with the exact same fields for reference -
// nothing submitted here is saved anywhere.
export default function PatientFeedbackPreview() {
  const [starRating, setStarRating] = useState(0);
  const [painScale, setPainScale] = useState(0);
  const [improvedPct, setImprovedPct] = useState(null);
  const [experienceText, setExperienceText] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [confidentialityConsent, setConfidentialityConsent] = useState(false);
  const [promotionalConsent, setPromotionalConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="brand-card space-y-6 max-w-lg">
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
          This may be shared as an anonymous testimonial only if they check the box below to allow it.
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
          🔒 This note is private — only the healer will see it. It will never be shown publicly or
          shared as a testimonial.
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

      <button onClick={() => setSubmitted(true)} className="btn-primary w-full">
        Submit feedback
      </button>
      {submitted && (
        <p className="text-xs text-amber-600 text-center">
          This is a preview — nothing was actually submitted. This is exactly what a patient sees
          after a completed session.
        </p>
      )}
    </div>
  );
}
