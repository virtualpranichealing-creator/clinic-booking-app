'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '../../lib/supabaseClient';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useSearchParams } from 'next/navigation';
import AppNav from '../../components/AppNav';
import {
  TIMEZONE_OPTIONS,
  loadStoredTimezone,
  storeTimezone,
} from '../../lib/timezone';
import { slotTypeIcon, SLOT_TYPE_SHORT_LABELS } from '../../lib/slotTypeIcons';
import { sessionTypeLabel } from '../../lib/sessionTypeLabel';
import { useIsMobile } from '../../lib/useIsMobile';
import { fetchHealerNames } from '../../lib/healerNames';

const STATUS_COLORS = {
  available: { bg: '#3D6B4A', border: '#2f5439' }, // brand green
  reserved: { bg: '#ca8a04', border: '#a16207' }, // yellow
  booked: { bg: '#dc2626', border: '#b91c1c' }, // red
};

// Reads a slot's own status column - set automatically by database triggers,
// so this works without needing access to other patients' private bookings
function getSlotStatus(slot) {
  return slot.current_status || 'available';
}

function PatientDashboardInner() {
  const searchParams = useSearchParams();
  const directHealerId = searchParams.get('healer');

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [healers, setHealers] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'byHealer'
  const [selectedHealer, setSelectedHealer] = useState(null);
  const [mainSlots, setMainSlots] = useState([]);
  const [healerSlots, setHealerSlots] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [feedbackByBooking, setFeedbackByBooking] = useState({});
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [regularHealer, setRegularHealer] = useState(null); // { id, name } if they've booked before
  const [bookingIntent, setBookingIntent] = useState(null); // null | 'withRegular' | 'browseOthers'

  // Booking modal state
  const [bookingSlot, setBookingSlot] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('qr_maribank');
  const [deliveryPreference, setDeliveryPreference] = useState('online_realtime');
  const [mainConcern, setMainConcern] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [myActivePackages, setMyActivePackages] = useState([]);
  const [usePackageId, setUsePackageId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  // Patient must complete their intake profile (same one used on the Portal
  // page) before they're allowed to book - reuses consent_agreed as the
  // single "profile complete" flag, same as the Portal page's own gate.
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  useEffect(() => {
    loadProfile();
  }, []);
  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('consent_agreed').eq('id', user.id).single();
    setProfile(data);
    setProfileLoading(false);

    const { data: pkgs } = await supabase
      .from('patient_packages')
      .select('id, sessions_remaining, packages(slot_type_id, name)')
      .eq('patient_id', user.id)
      .eq('payment_status', 'booked')
      .gt('sessions_remaining', 0);
    setMyActivePackages(pkgs || []);
  }

  // Display timezone - purely visual, doesn't change what's actually
  // booked. Defaults to the browser's detected zone (or Manila).
  const [timezone, setTimezone] = useState('Asia/Manila');
  const isMobile = useIsMobile();
  useEffect(() => {
    setTimezone(loadStoredTimezone());
  }, []);
  function handleTimezoneChange(tz) {
    setTimezone(tz);
    storeTimezone(tz);
  }

  useEffect(() => {
    loadCategories();
    loadMyBookings();
  }, []);

  useEffect(() => {
    loadHealers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  useEffect(() => {
    if (healers.length > 0) loadMainSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healers]);

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  }

  async function loadHealers() {
    const { data } = await supabase
      .from('healer_profiles')
      .select('user_id, specialty_summary, bio, healer_categories(category_id)')
      .eq('is_active', true)
      .eq('approval_status', 'approved');

    const namesById = await fetchHealerNames(supabase, (data || []).map((h) => h.user_id));
    const dataWithNames = (data || []).map((h) => ({ ...h, profiles: namesById[h.user_id] }));

    const filtered = selectedCategory
      ? dataWithNames.filter((h) =>
          h.healer_categories?.some((hc) => hc.category_id === selectedCategory)
        )
      : dataWithNames;
    setHealers(filtered);
  }

  // Combined calendar across every (category-filtered) healer
  async function loadMainSlots() {
    const healerIds = healers.map((h) => h.user_id);
    if (healerIds.length === 0) {
      setMainSlots([]);
      return;
    }
    const { data } = await supabase
      .from('slots')
      .select('*, slot_types(label, duration_minutes)')
      .in('healer_id', healerIds)
      .gte('start_time', new Date().toISOString())
      .order('start_time');
    setMainSlots(data || []);
  }

  // Single-healer calendar
  async function loadHealerSlots(healerId) {
    setSelectedHealer(healerId);
    setViewMode('byHealer');
    const { data } = await supabase
      .from('slots')
      .select('*, slot_types(label, duration_minutes)')
      .eq('healer_id', healerId)
      .gte('start_time', new Date().toISOString())
      .order('start_time');
    setHealerSlots(data || []);
  }

  async function loadMyBookings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, slots(start_time, end_time, slot_type_id, slot_types(label))')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false });

    const namesById = await fetchHealerNames(supabase, (data || []).map((b) => b.healer_id));
    const withNames = (data || []).map((b) => ({ ...b, healer_profiles: { profiles: namesById[b.healer_id] } }));
    setMyBookings(withNames);

    const bookingIds = withNames.map((b) => b.id);
    if (bookingIds.length > 0) {
      const { data: feedbackData } = await supabase
        .from('session_feedback')
        .select('id, booking_id, star_rating, pain_scale, symptoms_improved_pct')
        .in('booking_id', bookingIds);
      setFeedbackByBooking(Object.fromEntries((feedbackData || []).map((f) => [f.booking_id, f])));
    }

    const mostRecentActive = withNames.find((b) => b.status !== 'cancelled');
    if (directHealerId) {
      // Came from a specific healer's public profile page - skip the choice screen entirely
      setBookingIntent('withRegular');
      loadHealerSlots(directHealerId);
    } else if (mostRecentActive) {
      setRegularHealer({
        id: mostRecentActive.healer_id,
        name:
          mostRecentActive.healer_profiles?.profiles?.nickname ||
          mostRecentActive.healer_profiles?.profiles?.full_name ||
          'your healer',
      });
    } else {
      setBookingIntent('browseOthers'); // no history yet - go straight to browsing
    }
    setBookingsLoaded(true);
  }

  function healerName(healerId) {
    const h = healers.find((h) => h.user_id === healerId)?.profiles;
    return h?.nickname || h?.full_name || 'Healer';
  }

  function openBookingModal(slot) {
    if (getSlotStatus(slot) !== 'available') {
      window.alert('This slot is no longer available. Please choose an open (green) slot.');
      return;
    }
    setBookingSlot(slot);
    setPaymentMethod(slot.slot_type_id === 'physical_healing' ? 'pay_at_office' : 'qr_maribank');
    setDeliveryPreference('online_realtime');
    setProofFile(null);
    setBookingError(null);
    setUsePackageId(null);
    setMainConcern('');
  }

  function usablePackagesFor(slot) {
    if (!slot) return [];
    return myActivePackages.filter((p) => p.packages?.slot_type_id === slot.slot_type_id);
  }

  async function submitBooking() {
    const isPhysical = bookingSlot.slot_type_id === 'physical_healing';
    const usingPackage = !isPhysical && !!usePackageId;

    if (!mainConcern.trim()) {
      setBookingError('Please let us know your main concern for this session before submitting.');
      return;
    }
    if (!isPhysical && !usingPackage && !proofFile) {
      setBookingError('Please upload your proof of payment before submitting.');
      return;
    }
    setSubmitting(true);
    setBookingError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (usingPackage) {
      const { error: redeemError } = await supabase.rpc('redeem_package_session', {
        p_patient_package_id: usePackageId,
      });
      if (redeemError) {
        setBookingError(
          redeemError.message?.includes('No sessions')
            ? 'That package has no sessions remaining.'
            : 'Could not use your package for this booking. Please try again.'
        );
        setSubmitting(false);
        return;
      }
    }

    let filePath = null;
    if (!isPhysical && !usingPackage) {
      const fileExt = proofFile.name.split('.').pop();
      filePath = `${user.id}/${bookingSlot.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, proofFile);

      if (uploadError) {
        setBookingError('Could not upload your payment proof. Please try again.');
        setSubmitting(false);
        return;
      }
    }

    const { data: newBooking, error: bookingInsertError } = await supabase
      .from('bookings')
      .insert({
        slot_id: bookingSlot.id,
        patient_id: user.id,
        healer_id: bookingSlot.healer_id,
        status: 'reserved',
        payment_method: isPhysical ? 'pay_at_office' : usingPackage ? 'package' : paymentMethod,
        delivery_preference: isPhysical ? null : deliveryPreference,
        payment_proof_url: filePath,
        patient_package_id: usingPackage ? usePackageId : null,
        main_concern: mainConcern.trim() || null,
      })
      .select()
      .single();

    if (bookingInsertError) {
      setBookingError('Could not create the booking. Please try again.');
      setSubmitting(false);
      return;
    }

    fetch('/api/send-reserved-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: newBooking.id }),
    }).catch((err) => console.error('Failed to send reserved email:', err));

    setSubmitting(false);
    setBookingSlot(null);
    loadMainSlots();
    if (selectedHealer) loadHealerSlots(selectedHealer);
    loadMyBookings();
    loadProfile();
  }

  function buildEvents(slotList, { includeHealerName }) {
    return slotList.map((slot) => {
      const status = getSlotStatus(slot);
      const colors = STATUS_COLORS[status];
      // Onsite sessions happen at a physical location in Manila, so always
      // show their time in Manila time regardless of the patient's display
      // timezone preference - showing "their" time here would be misleading
      // about when to actually show up at the office.
      const slotTz = slot.slot_type_id === 'physical_healing' ? 'Asia/Manila' : timezone;
      const time = new Date(slot.start_time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: slotTz,
      });
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      const icon = slotTypeIcon(slot.slot_type_id);
      const title = includeHealerName
        ? `${icon} ${time} ${healerName(slot.healer_id)}`
        : `${icon} ${time} ${statusLabel}`;
      const shortTitle = includeHealerName
        ? `${icon} ${time} ${healerName(slot.healer_id)}`
        : `${icon} ${time}`;

      return {
        id: slot.id,
        title,
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        extendedProps: { status, shortTitle },
      };
    });
  }

  function renderCalendar(slotList, { includeHealerName }) {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
            <span>🩺 Consultation</span>
            <span>🌿 Online Healing</span>
            <span>📍 Onsite (Ortigas)</span>
          </div>
          <div className="flex items-center gap-2">
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
        </div>
        <p className="text-[11px] text-slate-400 text-right mb-2">
          📍 Onsite (Ortigas) sessions always show Philippine time, since that's where you'll need to be.
        </p>
        <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        height="auto"
        dayMaxEventRows={isMobile ? 2 : 4}
        eventDisplay="block"
        events={buildEvents(slotList, { includeHealerName })}
        eventClassNames={(arg) => [`slot-status-${arg.event.extendedProps.status}`]}
        eventContent={(arg) => {
          const compact = isMobile && arg.view.type === 'dayGridMonth';
          return (
            <div
              title={arg.event.title}
              className="px-1 py-0.5 text-[11px] leading-tight whitespace-normal break-words"
            >
              {compact ? arg.event.extendedProps.shortTitle : arg.event.title}
            </div>
          );
        }}

        eventClick={(info) => {
          const slot = slotList.find((s) => s.id === info.event.id);
          if (slot) openBookingModal(slot);
        }}
      />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <AppNav />

      {!profileLoading && profile && !profile.consent_agreed ? (
        <div className="brand-shell text-center py-12">
          <h1 className="font-script text-5xl text-brand-green mb-3">One quick step first</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Please complete your patient profile before booking a session — it only takes a
            minute, and helps your healer prepare for your first appointment.
          </p>
          <a href="/patient/portal" className="btn-primary inline-block">
            Complete my profile
          </a>
        </div>
      ) : (
        <>
      <h1 className="text-2xl font-display font-bold text-brand-green">Book an appointment</h1>

      {bookingsLoaded && regularHealer && bookingIntent === null && (
        <div className="border border-slate-200 rounded-lg p-5 space-y-3 bg-white">
          <p className="text-sm text-slate-600">
            You've worked with <strong className="text-brand-ink">{regularHealer.name}</strong> before.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setBookingIntent('withRegular');
                loadHealerSlots(regularHealer.id);
              }}
              className="bg-brand-green text-white rounded-full px-4 py-2 text-sm hover:opacity-90"
            >
              Continue with {regularHealer.name}
            </button>
            <button
              onClick={() => setBookingIntent('browseOthers')}
              className="border border-brand-green text-brand-green rounded-full px-4 py-2 text-sm"
            >
              Book a different healer instead
            </button>
          </div>
        </div>
      )}

      {bookingIntent === 'withRegular' && (
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium text-brand-green">
              {(regularHealer?.name || healerName(selectedHealer))}'s calendar
            </h2>
            <button
              onClick={() => setBookingIntent('browseOthers')}
              className="text-xs text-brand-green underline"
            >
              Book a different healer instead
            </button>
          </div>
          {healerSlots.length === 0 ? (
            <p className="text-slate-500 text-sm">No upcoming slots.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg p-3 bg-white">
              {renderCalendar(healerSlots, { includeHealerName: false })}
            </div>
          )}
        </section>
      )}

      {bookingIntent === 'browseOthers' && (
        <>
          <section>
            <h2 className="text-lg font-medium mb-3 text-brand-green">Browse by category</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`text-sm border rounded-full px-4 py-1.5 ${
                  selectedCategory === null
                    ? 'bg-brand-green text-white border-brand-green'
                    : 'border-slate-300 text-slate-600 hover:bg-brand-mint'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`text-sm border rounded-full px-4 py-1.5 ${
                    selectedCategory === c.id
                      ? 'bg-brand-green text-white border-brand-green'
                      : 'border-slate-300 text-slate-600 hover:bg-brand-mint'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </section>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#3D6B4A' }} />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#ca8a04' }} />
              Reserved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#dc2626' }} />
              Booked
            </span>
          </div>

          {/* View toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('all')}
              className={`text-sm rounded-full px-4 py-2 ${
                viewMode === 'all'
                  ? 'bg-brand-green text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-brand-mint'
              }`}
            >
              All healers (combined calendar)
            </button>
            <button
              onClick={() => setViewMode('byHealer')}
              className={`text-sm rounded-full px-4 py-2 ${
                viewMode === 'byHealer'
                  ? 'bg-brand-green text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-brand-mint'
              }`}
            >
              By healer
            </button>
          </div>

          {viewMode === 'all' && (
            <section>
              <h2 className="text-lg font-medium mb-3 text-brand-green">All healers - combined calendar</h2>
              {mainSlots.length === 0 ? (
                <p className="text-slate-500 text-sm">No upcoming slots yet.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg p-3 bg-white">
                  {renderCalendar(mainSlots, { includeHealerName: true })}
                </div>
              )}
            </section>
          )}

          {viewMode === 'byHealer' && (
            <>
              <section>
                <h2 className="text-lg font-medium mb-3 text-brand-green">Choose a healer</h2>
                {healers.length === 0 ? (
                  <p className="text-slate-500 text-sm">No healers found in this category yet.</p>
                ) : (
                  <select
                    value={selectedHealer || ''}
                    onChange={(e) => e.target.value && loadHealerSlots(e.target.value)}
                    className="brand-select max-w-sm"
                  >
                    <option value="" disabled>
                      Select a healer…
                    </option>
                    {healers.map((h) => (
                      <option key={h.user_id} value={h.user_id}>
                        {h.profiles?.nickname || h.profiles?.full_name}
                        {h.specialty_summary ? ` — ${h.specialty_summary}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </section>

              {selectedHealer && (
                <section>
                  <h2 className="text-lg font-medium mb-3 text-brand-green">
                    {healerName(selectedHealer)}'s calendar
                  </h2>
                  {healerSlots.length === 0 ? (
                    <p className="text-slate-500 text-sm">No upcoming slots.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg p-3 bg-white">
                      {renderCalendar(healerSlots, { includeHealerName: false })}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3 text-brand-green">My bookings</h2>
        <ul className="space-y-2">
          {myBookings.length === 0 && (
            <p className="text-slate-500 text-sm">No bookings yet.</p>
          )}
          {myBookings.map((b) => (
            <li key={b.id} className="border border-slate-200 rounded p-3 text-sm flex justify-between bg-white">
              <span className="text-brand-ink">
                <span className="font-medium">
                  {slotTypeIcon(b.slots?.slot_type_id)}{' '}
                  {sessionTypeLabel({
                    slotTypeId: b.slots?.slot_type_id,
                    deliveryPreference: b.delivery_preference,
                    paymentMethod: b.payment_method,
                  })}
                </span>{' '}
                — {b.healer_profiles?.profiles?.nickname || b.healer_profiles?.profiles?.full_name} -{' '}
                {new Date(b.slots?.start_time).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: b.payment_method === 'pay_at_office' ? 'Asia/Manila' : timezone,
                })}
              </span>
              <div className="flex items-center gap-2">
                <span className="capitalize text-slate-500">{b.status}</span>
                {b.status === 'completed' && (
                  feedbackByBooking[b.id] ? (
                    <span className="text-amber-500 text-xs whitespace-nowrap">
                      {'★'.repeat(feedbackByBooking[b.id].star_rating)}
                      {'☆'.repeat(5 - feedbackByBooking[b.id].star_rating)}
                    </span>
                  ) : (
                    <a
                      href={`/patient/feedback/${b.id}`}
                      className="text-xs text-brand-green underline underline-offset-2 whitespace-nowrap"
                    >
                      Leave feedback
                    </a>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Booking modal */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-display font-bold text-brand-green">Confirm your booking</h3>
              <button
                onClick={() => setBookingSlot(null)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0 -mt-1"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-600">
              {healerName(bookingSlot.healer_id)} -{' '}
              {new Date(bookingSlot.start_time).toLocaleString([], {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: bookingSlot.slot_type_id === 'physical_healing' ? 'Asia/Manila' : timezone,
              })} -{' '}
              {bookingSlot.slot_types?.label}
            </p>

            <div>
              <label className="block text-sm font-medium mb-1 text-brand-ink">
                What's your main concern for this session? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={mainConcern}
                onChange={(e) => setMainConcern(e.target.value)}
                rows={3}
                placeholder="e.g. lower back pain, stress and anxiety, trouble sleeping…"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This will be shared with your healer so they can prepare for your session.
              </p>
            </div>

            {bookingSlot.slot_type_id === 'physical_healing' ? (
              <div className="p-4 bg-brand-mint/40 border border-brand-green/30 rounded-xl text-sm space-y-1">
                <p className="font-semibold text-brand-green">📍 In-person session — PHFP Ortigas Center</p>
                <p className="text-slate-600">
                  This is a face-to-face healing session at our Ortigas office. No online payment or
                  proof of payment is needed here — please bring your payment and settle it at the
                  office when you arrive for your session.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2 text-brand-ink">
                  How would you like to receive this session?
                </label>
                <div className="space-y-2 text-sm">
                  <label className="flex items-start gap-2 border border-slate-200 rounded-xl p-3">
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryPreference === 'online_realtime'}
                      onChange={() => setDeliveryPreference('online_realtime')}
                      className="mt-1"
                    />
                    <span>
                      <strong className="text-brand-ink">Online Real-Time</strong> - I'll attend the scheduled online session
                      and receive healing live with the healer.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 border border-slate-200 rounded-xl p-3">
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryPreference === 'distant'}
                      onChange={() => setDeliveryPreference('distant')}
                      className="mt-1"
                    />
                    <span>
                      <strong className="text-brand-ink">Distant Healing</strong> - the healer will perform the healing at
                      this scheduled time while I rest in a quiet, conducive place. They'll post
                      an update in my Portal afterward.
                    </span>
                  </label>
                </div>
              </div>
            )}
{bookingSlot.slot_type_id !== 'physical_healing' && (
<>
{/* Dynamic Instructions Panel */}
<div className="p-4 bg-slate-50 border border-slate-200 rounded-xl my-3">
  <p className="text-xs font-semibold text-slate-700 mb-2">
    Payment instructions: For our Project Hope, please use the following bank details. Scan the QR Code or send via PayPal:
  </p>

  {paymentMethod === 'qr_maribank' ? (
    <div className="text-center space-y-2 mt-1">
      <p className="text-[11px] text-slate-500 font-medium">Scan this MariBank QR code using your bank app:</p>
      <div className="inline-block p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
<img 
  src="https://yyslpzxsfslvdegayswa.supabase.co/storage/v1/object/sign/payment-proofs/maribank-qr.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81OTNiY2RlNi00Njc2LTQ1MzItOTgyZC01OWM1MzY4Y2Y1OTUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYXltZW50LXByb29mcy9tYXJpYmFuay1xci5qcGciLCJzY29wZSI6ImRvd25sb2FkIiwiaWF0IjoxNzg1NDcyNDMwLCJleHAiOjE4MTcwMDg0MzB9.4sQLsv1JH5NCBxDdXsQtg94LRqO5SuZT_FMgBQLuRKI" 
  alt="MariBank QR Code" 
  className="w-32 h-32 object-contain mx-auto"
/>
      </div>
    </div>
  ) : (
    <div className="w-full space-y-2 mt-1 text-center">
      <p className="text-[11px] text-slate-500 font-medium">Send payment directly to our PayPal account:</p>
      <div className="flex items-center gap-2 max-w-xs mx-auto">
        <input
          type="text"
          value="virtualpranichealing@gmail.com"
          readOnly
          className="flex-1 p-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-600 focus:outline-none font-mono"
        />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText("virtualpranichealing@gmail.com");
            alert("Email copied!");
          }}
          className="px-3 py-2 text-xs font-bold text-white rounded-lg whitespace-nowrap bg-slate-800 hover:bg-slate-900"
        >
          Copy
        </button>
      </div>
    </div>
  )}
</div>

            {usablePackagesFor(bookingSlot).length > 0 && (
              <div className="p-3 bg-brand-mintSoft rounded-xl">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!usePackageId}
                    onChange={(e) =>
                      setUsePackageId(e.target.checked ? usablePackagesFor(bookingSlot)[0].id : null)
                    }
                    className="mt-1"
                  />
                  <span>
                    <strong className="text-brand-ink">Use my package</strong>
                    {usablePackagesFor(bookingSlot).length === 1 ? (
                      <> — {usablePackagesFor(bookingSlot)[0].packages?.name} ({usablePackagesFor(bookingSlot)[0].sessions_remaining} sessions left)</>
                    ) : (
                      ' — you have more than one active package'
                    )}
                  </span>
                </label>
                {usePackageId && usablePackagesFor(bookingSlot).length > 1 && (
                  <select
                    value={usePackageId}
                    onChange={(e) => setUsePackageId(e.target.value)}
                    className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    {usablePackagesFor(bookingSlot).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.packages?.name} ({p.sessions_remaining} sessions left)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {!usePackageId && (
              <>
            <div>
              <label className="block text-sm font-medium mb-1 text-brand-ink">Payment method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2"
              >
                <option value="qr_maribank">QR / Maribank</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-brand-ink">
                Upload proof of payment (screenshot/receipt)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
            </div>
              </>
            )}
</>
)}

            {bookingError && <p className="text-red-600 text-sm">{bookingError}</p>}

            {bookingSlot.slot_type_id === 'physical_healing' ? (
              <p className="text-xs text-slate-500">
                Your slot will be held as <strong>Reserved</strong> once submitted. We'll confirm
                your booking once we see you (and your payment) at the office.
              </p>
            ) : usePackageId ? (
              <>
                <p className="text-xs text-slate-500">
                  This session will use one credit from your package. Your slot will be held as{' '}
                  <strong>Reserved</strong> until admin confirms your booking — no extra payment needed.
                </p>
                <p className="text-xs text-slate-500">
                  You'll receive a confirmation email once confirmed — if you don't see it, please
                  check your <strong>Spam/Junk folder</strong> as well.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Your slot will be held as <strong>Reserved</strong> once submitted. Our team will
                  verify your payment and confirm your booking shortly.
                </p>
                <p className="text-xs text-slate-500">
                  You'll receive a confirmation email once verified — if you don't see it, please
                  check your <strong>Spam/Junk folder</strong> as well.
                </p>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setBookingSlot(null)}
                className="px-4 py-2 text-sm rounded-full border border-slate-300 text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={submitBooking}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-full bg-brand-green text-white hover:opacity-90"
              >
                {submitting ? 'Submitting...' : 'Submit booking'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default function PatientDashboard() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500 text-sm">Loading...</div>}>
      <PatientDashboardInner />
    </Suspense>
  );
}
