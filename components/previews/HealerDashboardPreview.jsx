'use client';

import { useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SAMPLE_RULES = [
  { id: 'r1', day: 'Monday', time: '09:00–10:00', type: 'Online Pranic Healing Session' },
  { id: 'r2', day: 'Wednesday', time: '14:00–14:30', type: 'Consultation' },
];

const SAMPLE_SLOTS = [
  { id: 's1', label: 'Mon, Aug 17 · 9:00 AM — Online Pranic Healing Session', booked: false },
  { id: 's2', label: 'Wed, Aug 19 · 2:00 PM — Consultation', booked: true },
  { id: 's3', label: 'Mon, Aug 24 · 9:00 AM — Online Pranic Healing Session', booked: false },
];

const SAMPLE_BOOKINGS = [
  { id: 'b1', patient: 'Maria Santos', type: '🌿 Online Pranic Healing Session', when: 'Aug 19, 2:00 PM', status: 'booked' },
  { id: 'b2', patient: 'Jun Dela Cruz', type: '🩺 Consultation', when: 'Aug 12, 3:30 PM', status: 'completed' },
];

// A simulated version of the healer dashboard (app/healer/page.jsx), using
// made-up sample data rather than any real healer's account - so admin can
// see the general shape of what healers work with, without needing to open
// a real person's data to do it. Fully interactive locally; nothing here
// touches the database.
export default function HealerDashboardPreview() {
  const [rules, setRules] = useState(SAMPLE_RULES);
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [slots, setSlots] = useState(SAMPLE_SLOTS);
  const [bookings, setBookings] = useState(SAMPLE_BOOKINGS);
  const [note, setNote] = useState(null);

  function addRule(e) {
    e.preventDefault();
    setRules((prev) => [
      ...prev,
      { id: `r${Date.now()}`, day: dayOfWeek, time: `${startTime}–${endTime}`, type: 'Online Pranic Healing Session' },
    ]);
    setNote('rule');
  }

  function removeRule(id) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function removeSlot(id) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function markStatus(id, status) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }

  return (
    <div className="brand-card space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-brand-ink mb-1">Weekly availability</h4>
        <form onSubmit={addRule} className="flex flex-wrap gap-3 items-end mb-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Day</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm"
            >
              {DAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="bg-slate-800 text-white rounded px-4 py-2 text-sm">
            Add weekly slot
          </button>
        </form>
        <ul className="space-y-1">
          {rules.map((r) => (
            <li key={r.id} className="text-sm flex justify-between border rounded px-3 py-2">
              <span>
                {r.day} {r.time} — {r.type}
              </span>
              <button onClick={() => removeRule(r.id)} className="text-red-600 text-xs">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h4 className="text-sm font-semibold text-brand-ink mb-2">Upcoming slots</h4>
        <ul className="space-y-1">
          {slots.map((s) => (
            <li key={s.id} className={`text-sm flex justify-between border rounded px-3 py-2 ${s.booked ? 'bg-slate-50' : ''}`}>
              <span>{s.label}</span>
              {s.booked ? (
                <span className="text-xs text-slate-400">Booked</span>
              ) : (
                <button onClick={() => removeSlot(s.id)} className="text-red-600 text-xs">
                  Remove / block this date
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h4 className="text-sm font-semibold text-brand-ink mb-2">My bookings</h4>
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="border rounded p-3 text-sm space-y-1.5">
              <div className="flex justify-between items-center">
                <span>
                  <span className="font-medium text-brand-ink">{b.type}</span> — {b.patient} — {b.when}
                </span>
                <div className="flex gap-2 items-center">
                  <span className="capitalize text-slate-500">{b.status}</span>
                  {b.status === 'booked' && (
                    <>
                      <button
                        onClick={() => markStatus(b.id, 'completed')}
                        className="text-xs border rounded px-2 py-1 hover:bg-slate-100"
                      >
                        Mark completed
                      </button>
                      <button
                        onClick={() => markStatus(b.id, 'no_show')}
                        className="text-xs border rounded px-2 py-1 hover:bg-slate-100"
                      >
                        No-show
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {note && (
        <p className="text-xs text-amber-600">
          This is a simulation with made-up sample data — this is exactly what a healer's dashboard
          looks like, but nothing here is a real account or booking.
        </p>
      )}
    </div>
  );
}
