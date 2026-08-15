'use client';

import { useState } from 'react';

const SAMPLE_CATEGORIES = ['Emotional & Mental Wellness', 'Healthy Aging & Preventive Care', 'Physical Health & Recovery'];

const SAMPLE_HEALERS = ['Louise', 'Aprea', 'Marixi Salud'];

const SAMPLE_SLOTS = [
  { id: 't1', label: 'Mon, Aug 17 · 9 AM' },
  { id: 't2', label: 'Wed, Aug 19 · 2 PM' },
  { id: 't3', label: 'Fri, Aug 21 · 4 PM' },
];

// A simulated version of the patient booking flow (app/patient/page.jsx),
// using made-up sample healers/slots rather than any real patient's account -
// so admin can see the general shape of what patients work with, without
// needing to open a real person's data to do it. Fully interactive locally;
// nothing here touches the database.
export default function PatientDashboardPreview() {
  const [category, setCategory] = useState(SAMPLE_CATEGORIES[0]);
  const [healer, setHealer] = useState(SAMPLE_HEALERS[0]);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [mainConcern, setMainConcern] = useState('');
  const [painLevel, setPainLevel] = useState(null);
  const [deliveryPreference, setDeliveryPreference] = useState('online_realtime');
  const [submitted, setSubmitted] = useState(false);

  function openBooking(slot) {
    setBookingSlot(slot);
    setSubmitted(false);
  }

  function submitBooking() {
    setSubmitted(true);
  }

  return (
    <div className="brand-card space-y-5">
      <div>
        <h4 className="text-sm font-semibold text-brand-ink mb-2">Browse by category</h4>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`text-sm border rounded-full px-4 py-1.5 ${
                category === c ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-brand-ink mb-2">Choose a healer</h4>
        <select
          value={healer}
          onChange={(e) => setHealer(e.target.value)}
          className="brand-select max-w-sm"
        >
          {SAMPLE_HEALERS.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-brand-ink mb-2">Available times with {healer}</h4>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_SLOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openBooking(s)}
              className="pill-available text-sm px-4 py-2"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {bookingSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-brandLg my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-display font-bold text-brand-green">Book with {healer}</h3>
              <button
                onClick={() => setBookingSlot(null)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0 -mt-1"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-500">{bookingSlot.label}</p>

            <div>
              <label className="brand-label">What's your main concern for this session?</label>
              <textarea
                value={mainConcern}
                onChange={(e) => setMainConcern(e.target.value)}
                rows={3}
                placeholder="e.g. lower back pain, stress and anxiety, trouble sleeping…"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base resize-none"
              />
            </div>

            <div>
              <label className="brand-label mb-2">Pain level right now (0–10)</label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPainLevel(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors ${
                      painLevel === n
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
              <label className="brand-label mb-2">How would you like this session delivered?</label>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={deliveryPreference === 'online_realtime'}
                    onChange={() => setDeliveryPreference('online_realtime')}
                  />
                  Online Real-Time (Zoom)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={deliveryPreference === 'distant'}
                    onChange={() => setDeliveryPreference('distant')}
                  />
                  Distant Healing
                </label>
              </div>
            </div>

            <button onClick={submitBooking} className="btn-primary w-full">
              Submit booking
            </button>
            {submitted && (
              <p className="text-xs text-amber-600 text-center">
                This is a simulation with made-up sample data — this is exactly what a patient sees
                when booking, but nothing here is a real account or booking.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
