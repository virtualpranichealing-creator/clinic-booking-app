'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AppNav from '../../components/AppNav';
import { TIMEZONE_OPTIONS, loadStoredTimezone, storeTimezone } from '../../lib/timezone';
import { slotTypeIcon } from '../../lib/slotTypeIcons';
import { sessionTypeLabel } from '../../lib/sessionTypeLabel';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HealerDashboard() {
  const [bookings, setBookings] = useState([]);
  const [feedbackByBooking, setFeedbackByBooking] = useState({});
  const [rules, setRules] = useState([]);
  const [upcomingSlots, setUpcomingSlots] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [profileComplete, setProfileComplete] = useState(true);

  // Display timezone - purely visual, defaults to browser-detected zone.
  const [timezone, setTimezone] = useState('Asia/Manila');
  useEffect(() => {
    setTimezone(loadStoredTimezone());
  }, []);
  function handleTimezoneChange(tz) {
    setTimezone(tz);
    storeTimezone(tz);
  }

  // New rule form state
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday default
  const [slotType, setSlotType] = useState('healing');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const isPhysical = slotType === 'physical_healing';
  const PHYSICAL_DAYS = [2, 3, 4, 5]; // Tue-Fri only
  const PHYSICAL_BLOCKS = [
    { label: '2:00 – 3:00 PM', start: '14:00', end: '15:00' },
    { label: '3:00 – 4:00 PM', start: '15:00', end: '16:00' },
    { label: '4:00 – 5:00 PM', start: '16:00', end: '17:00' },
  ];

  // Onsite sessions only happen Tue-Fri, within 2-5 PM, in 1-hour blocks -
  // switching to that session type snaps the form to the first valid block.
  function handleSlotTypeChange(value) {
    setSlotType(value);
    if (value === 'physical_healing') {
      if (!PHYSICAL_DAYS.includes(dayOfWeek)) setDayOfWeek(2);
      setStartTime(PHYSICAL_BLOCKS[0].start);
      setEndTime(PHYSICAL_BLOCKS[0].end);
    }
  }

  function handlePhysicalBlockChange(start) {
    const block = PHYSICAL_BLOCKS.find((b) => b.start === start);
    setStartTime(block.start);
    setEndTime(block.end);
  }

  useEffect(() => {
    loadBookings();
    loadRules();
    loadUpcomingSlots();
    loadApprovalStatus();
  }, []);

  async function loadApprovalStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('healer_profiles')
      .select('approval_status, specialty_summary, bio, title, photo_url')
      .eq('user_id', user.id)
      .single();
    setApprovalStatus(data?.approval_status);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('mobile')
      .eq('id', user.id)
      .single();

    setProfileComplete(
      !!(data?.specialty_summary && data?.bio && data?.title && data?.photo_url && profileData?.mobile)
    );
  }

  async function loadBookings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('bookings')
      .select(
        '*, slots(start_time, end_time, slot_type_id, slot_types(label)), profiles!bookings_patient_id_fkey(full_name)'
      )
      .eq('healer_id', user.id)
      .order('created_at', { ascending: false });

    setBookings(data || []);

    const bookingIds = (data || []).map((b) => b.id);
    if (bookingIds.length > 0) {
      const { data: feedbackData } = await supabase
        .from('session_feedback')
        .select('id, booking_id, star_rating, pain_scale, symptoms_improved_pct, experience_text, private_note_to_healer')
        .in('booking_id', bookingIds);
      setFeedbackByBooking(Object.fromEntries((feedbackData || []).map((f) => [f.booking_id, f])));
    }
  }

  async function loadRules() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('availability_rules')
      .select('*, slot_types(label)')
      .eq('healer_id', user.id)
      .order('day_of_week');
    setRules(data || []);
  }

  async function loadUpcomingSlots() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('slots')
      .select('*, slot_types(label)')
      .eq('healer_id', user.id)
      .gte('start_time', new Date().toISOString())
      .order('start_time');
    setUpcomingSlots(data || []);
  }

  async function addRule(e) {
    e.preventDefault();

    if (
      isPhysical &&
      (!PHYSICAL_DAYS.includes(dayOfWeek) ||
        !PHYSICAL_BLOCKS.some((b) => b.start === startTime && b.end === endTime))
    ) {
      window.alert('Onsite physical sessions are only available Tuesday–Friday, in the 2–5 PM hourly blocks.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('availability_rules').insert({
      healer_id: user.id,
      slot_type_id: slotType,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    });

    loadRules();
  }

  async function deleteRule(ruleId) {
    await supabase.from('availability_rules').delete().eq('id', ruleId);
    loadRules();
  }

  async function generateSlots() {
    setGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.rpc('generate_slots_for_healer', {
      p_healer_id: user.id,
      p_weeks_ahead: 4,
    });
    await loadUpcomingSlots();
    setGenerating(false);
  }

  async function blockSlot(slotId) {
    // Only unbooked slots can be deleted/blocked this way
    await supabase.from('slots').delete().eq('id', slotId).eq('is_booked', false);
    loadUpcomingSlots();
  }

  async function markStatus(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId);
    loadBookings();
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-10">
      <AppNav />

      {approvalStatus === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm rounded-lg p-4">
          Your account is <strong>pending admin approval</strong>. Patients won't be able to see
          or book you yet — you can still set up your availability and profile in the meantime.
        </div>
      )}
      {approvalStatus === 'rejected' && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm rounded-lg p-4">
          Your healer account was not approved. Please contact the admin team for details.
        </div>
      )}
      <h1 className="text-2xl font-semibold">Healer dashboard</h1>

      <div className="flex items-center justify-end gap-2 -mt-6">
        <label className="text-xs text-slate-500">Show times in:</label>
        <select
          value={timezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          className="text-xs border border-slate-200 rounded-full px-3 py-1 text-brand-ink bg-white"
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      {/* Weekly recurring availability */}
      {!profileComplete ? (
        <section className="brand-card text-center py-10">
          <p className="text-brand-ink font-medium mb-1">Complete your profile first</p>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
            Please fill in your specialty summary, title, bio, phone number, and a profile photo
            on your profile page before setting your weekly availability — patients see this
            before booking with you.
          </p>
          <a href="/healer/profile" className="btn-primary inline-block">
            Complete my profile
          </a>
        </section>
      ) : (
      <section>
        <h2 className="text-lg font-medium mb-1">Weekly availability</h2>
        <p className="text-sm text-slate-500 mb-3">
          Set your standing weekly hours here. This is the recurring pattern — you don't need to
          re-add it every week.
        </p>

        <form onSubmit={addRule} className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Day</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="border border-slate-300 rounded px-3 py-2"
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i} disabled={isPhysical && !PHYSICAL_DAYS.includes(i)}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Session type</label>
            <select
              value={slotType}
              onChange={(e) => handleSlotTypeChange(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2"
            >
              <option value="consultation">Consultation (30 min)</option>
              <option value="healing">Online Pranic Healing Session (60 min)</option>
              <option value="physical_healing">Physical Healing Session — Onsite Ortigas (Tue–Fri, 2–5 PM)</option>
            </select>
          </div>
          {isPhysical ? (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Onsite hour block</label>
              <select
                value={startTime}
                onChange={(e) => handlePhysicalBlockChange(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2"
              >
                {PHYSICAL_BLOCKS.map((b) => (
                  <option key={b.start} value={b.start}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-2"
                />
              </div>
            </>
          )}
          <button type="submit" className="bg-slate-800 text-white rounded px-4 py-2">
            Add weekly slot
          </button>
        </form>
        {isPhysical && (
          <p className="text-xs text-slate-500 -mt-2 mb-4">
            📍 Onsite sessions at the PHFP Ortigas Center run Tuesday–Friday, between 2:00–5:00 PM.
            Pick the day and the specific hour you're free — you can add more than one block per day
            if you're free for longer.
          </p>
        )}

        <ul className="space-y-1 mb-4">
          {rules.map((r) => (
            <li key={r.id} className="text-sm flex justify-between border rounded px-3 py-2">
              <span>
                {DAYS[r.day_of_week]} {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)} —{' '}
                {r.slot_types?.label}
              </span>
              <button onClick={() => deleteRule(r.id)} className="text-red-600 text-xs">
                Remove
              </button>
            </li>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-slate-500">No weekly rules set yet.</p>
          )}
        </ul>

        <button
          onClick={generateSlots}
          disabled={generating || rules.length === 0}
          className="bg-green-700 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate bookable slots (next 4 weeks)'}
        </button>
        <p className="text-xs text-slate-500 mt-1">
          Run this any time you add new weekly rules, or to extend the calendar further out.
        </p>
      </section>
      )}

      {/* Upcoming slots — delete one to block that specific date/time */}
      <section>
        <h2 className="text-lg font-medium mb-1">Your upcoming slots</h2>
        <p className="text-sm text-slate-500 mb-3">
          These were generated from your weekly rules above. If you're unavailable on a specific
          date, just remove that one slot below — it won't affect your recurring schedule.
        </p>
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {upcomingSlots.map((s) => (
            <li
              key={s.id}
              className={`text-sm flex justify-between border rounded px-3 py-2 ${
                s.is_booked ? 'bg-slate-50' : ''
              }`}
            >
              <span>
                {new Date(s.start_time).toLocaleString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: s.slot_type_id === 'physical_healing' ? 'Asia/Manila' : timezone,
                })}{' '}
                — {s.slot_types?.label}
              </span>
              {s.is_booked ? (
                <span className="text-xs text-slate-400">Booked</span>
              ) : (
                <button onClick={() => blockSlot(s.id)} className="text-red-600 text-xs">
                  Remove / block this date
                </button>
              )}
            </li>
          ))}
          {upcomingSlots.length === 0 && (
            <p className="text-sm text-slate-500">
              No slots generated yet — add weekly rules above and click "Generate bookable slots."
            </p>
          )}
        </ul>
      </section>

      {/* Bookings */}
      <section>
        <h2 className="text-lg font-medium mb-3">My bookings</h2>
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="border rounded p-3 text-sm space-y-1.5">
              <div className="flex justify-between items-center">
              <span>
                <span className="font-medium text-brand-ink">
                  {slotTypeIcon(b.slots?.slot_type_id)}{' '}
                  {sessionTypeLabel({
                    slotTypeId: b.slots?.slot_type_id,
                    deliveryPreference: b.delivery_preference,
                    paymentMethod: b.payment_method,
                  })}
                </span>{' '}
                — {b.profiles?.full_name} —{' '}
                {new Date(b.slots?.start_time).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: b.payment_method === 'pay_at_office' ? 'Asia/Manila' : timezone,
                })}
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
              {b.main_concern && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5">
                  <span className="font-medium text-slate-600">Main concern:</span> {b.main_concern}
                </p>
              )}
              {b.status === 'completed' && (
                feedbackByBooking[b.id] ? (
                  <p className="text-xs bg-brand-mintSoft rounded-lg px-2.5 py-1.5">
                    <span className="text-amber-500">
                      {'★'.repeat(feedbackByBooking[b.id].star_rating)}
                      {'☆'.repeat(5 - feedbackByBooking[b.id].star_rating)}
                    </span>{' '}
                    <span className="text-slate-500">
                      Pain {feedbackByBooking[b.id].pain_scale}/10 ·{' '}
                      {feedbackByBooking[b.id].symptoms_improved_pct}% improved
                    </span>
                    {feedbackByBooking[b.id].private_note_to_healer && (
                      <span className="block text-brand-green mt-0.5">
                        🔒 {feedbackByBooking[b.id].private_note_to_healer}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">No feedback submitted yet.</p>
                )
              )}
            </li>
          ))}
          {bookings.length === 0 && (
            <p className="text-sm text-slate-500">No bookings yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
