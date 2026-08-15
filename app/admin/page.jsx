'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import AppNav from '../../components/AppNav';
import PatientFeedbackPreview from '../../components/previews/PatientFeedbackPreview';
import HealerNotePreview from '../../components/previews/HealerNotePreview';
import { supabase } from '../../lib/supabaseClient';
import { slotTypeIcon } from '../../lib/slotTypeIcons';
import { sessionTypeLabel } from '../../lib/sessionTypeLabel';
import { useIsMobile } from '../../lib/useIsMobile';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const STATUS_COLORS = {
  available: { bg: '#3D6B4A', border: '#2f5439' }, // brand green
  reserved: { bg: '#ca8a04', border: '#a16207' }, // yellow
  booked: { bg: '#dc2626', border: '#b91c1c' }, // red
};

const SPLIT_LABELS = [
  { key: 'foundation_amount', label: 'Pranic Healing Foundation of the Philippines', pct: '38%' },
  { key: 'healer_amount', label: 'The Pranic Healer', pct: '38%' },
  { key: 'referral_amount', label: 'Referred the patient', pct: '6%' },
  { key: 'admin_amount', label: 'Project HOPE Admin', pct: '18%' },
];

function ProofLink({ bucket, path, label }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleClick(e) {
    e.preventDefault();
    if (url) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }
    setLoading(true);
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    setLoading(false);
    if (data) {
      setUrl(data.signedUrl);
      window.open(data.signedUrl, '_blank', 'noreferrer');
    }
  }

  return (
    <button onClick={handleClick} className="text-brand-green underline text-xs">
      {loading ? 'Loading…' : label}
    </button>
  );
}

function AdminDashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'summary';
  function setActiveTab(tabId) {
    router.push(`/admin?tab=${tabId}`);
  }

  const [pendingBookings, setPendingBookings] = useState([]);
  const [pendingPackages, setPendingPackages] = useState([]);
  const [packageProofUrls, setPackageProofUrls] = useState({});
  const [healers, setHealers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [feedbackByBooking, setFeedbackByBooking] = useState({});
  const [copiedFeedbackId, setCopiedFeedbackId] = useState(null);
  const [proofUrls, setProofUrls] = useState({});
  const [paymentAmounts, setPaymentAmounts] = useState({});

  // Calendar section state
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [calendarHealerFilter, setCalendarHealerFilter] = useState('all');
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [selectedSlotDetails, setSelectedSlotDetails] = useState(null);
  const isMobile = useIsMobile();

  // Payments tab state
  const [payouts, setPayouts] = useState([]);
  const [missingPayoutBookings, setMissingPayoutBookings] = useState([]);
  const [missingAmounts, setMissingAmounts] = useState({});
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState(null);

  useEffect(() => {
    loadPending();
    loadPendingPackages();
    loadHealers();
    loadPatients();
    loadAllBookings();
    loadPayouts();
  }, []);

  useEffect(() => {
    if (healers.length > 0) loadCalendarSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healers]);

  async function loadPending() {
    const { data } = await supabase
      .from('bookings')
      .select(
        '*, slots(start_time, slot_type_id, slot_types(label, price)), healer_profiles(profiles(full_name, nickname)), profiles!bookings_patient_id_fkey(full_name, phone)'
      )
      .eq('status', 'reserved')
      .order('created_at', { ascending: true });
    setPendingBookings(data || []);

    setPaymentAmounts((prev) => {
      const next = { ...prev };
      for (const b of data || []) {
        if (next[b.id] === undefined) {
          next[b.id] = b.amount ?? b.slots?.slot_types?.price ?? '';
        }
      }
      return next;
    });

    const urls = {};
    for (const b of data || []) {
      if (b.payment_proof_url) {
        const { data: signed } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(b.payment_proof_url, 3600);
        if (signed) urls[b.id] = signed.signedUrl;
      }
    }
    setProofUrls(urls);
  }

  async function loadPendingPackages() {
    const { data } = await supabase
      .from('patient_packages')
      .select('*, packages(name, session_count, price), profiles!patient_packages_patient_id_fkey(full_name, phone)')
      .eq('payment_status', 'reserved')
      .order('purchased_at', { ascending: true });
    setPendingPackages(data || []);

    const urls = {};
    for (const p of data || []) {
      if (p.payment_proof_url) {
        const { data: signed } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(p.payment_proof_url, 3600);
        if (signed) urls[p.id] = signed.signedUrl;
      }
    }
    setPackageProofUrls(urls);
  }

  async function setPackageApproval(patientPackageId, status) {
    await supabase.from('patient_packages').update({ payment_status: status }).eq('id', patientPackageId);
    loadPendingPackages();
  }

  async function loadHealers() {
    const { data } = await supabase
      .from('healer_profiles')
      .select('*, profiles(full_name, nickname)');
    setHealers(data || []);
  }

  async function loadPatients() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'patient')
      .order('created_at', { ascending: false });
    setPatients(data || []);
  }

  async function loadAllBookings() {
    const { data } = await supabase
      .from('bookings')
      .select(
        '*, slots(start_time, slot_type_id), healer_profiles(profiles(full_name, nickname)), profiles!bookings_patient_id_fkey(full_name)'
      )
      .order('created_at', { ascending: false })
      .limit(50);
    setAllBookings(data || []);

    const bookingIds = (data || []).map((b) => b.id);
    if (bookingIds.length > 0) {
      const { data: feedbackData } = await supabase
        .from('session_feedback')
        .select('id, booking_id, star_rating, pain_scale, symptoms_improved_pct, experience_text, promotional_consent')
        .in('booking_id', bookingIds);
      setFeedbackByBooking(Object.fromEntries((feedbackData || []).map((f) => [f.booking_id, f])));
    }
  }

  async function copyFeedbackLink(bookingId) {
    const url = `${window.location.origin}/patient/feedback/${bookingId}`;
    await navigator.clipboard.writeText(url);
    setCopiedFeedbackId(bookingId);
    setTimeout(() => setCopiedFeedbackId(null), 2000);
  }

  // Pulls every slot for every healer, then enriches each with its active
  // booking (if any) so admin can see who booked it, not just the status color.
  async function loadCalendarSlots() {
    setCalendarLoading(true);
    const healerIds = healers.map((h) => h.user_id);
    if (healerIds.length === 0) {
      setCalendarSlots([]);
      setCalendarLoading(false);
      return;
    }

    const { data: slotsData } = await supabase
      .from('slots')
      .select('*, slot_types(label, duration_minutes, price)')
      .in('healer_id', healerIds)
      .order('start_time');

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, slot_id, status, payment_method, delivery_preference, patient_package_id, main_concern, pain_level_before, profiles!bookings_patient_id_fkey(full_name, phone)')
      .in('healer_id', healerIds)
      .in('status', ['reserved', 'booked']);

    const bookingBySlot = {};
    (bookingsData || []).forEach((b) => {
      bookingBySlot[b.slot_id] = b;
    });

    const enriched = (slotsData || []).map((s) => ({
      ...s,
      booking: bookingBySlot[s.id] || null,
    }));

    setCalendarSlots(enriched);
    setCalendarLoading(false);
  }

  function healerName(healerId) {
    const h = healers.find((h) => h.user_id === healerId)?.profiles;
    return h?.nickname || h?.full_name || 'Healer';
  }

  function getSlotStatus(slot) {
    if (slot.booking?.status === 'booked') return 'booked';
    if (slot.booking?.status === 'reserved') return 'reserved';
    return slot.current_status && slot.current_status !== 'available'
      ? slot.current_status
      : 'available';
  }

  function buildCalendarEvents() {
    const filtered =
      calendarHealerFilter === 'all'
        ? calendarSlots
        : calendarSlots.filter((s) => s.healer_id === calendarHealerFilter);

    return filtered.map((slot) => {
      const status = getSlotStatus(slot);
      const colors = STATUS_COLORS[status];
      const time = new Date(slot.start_time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const patientName = slot.booking?.profiles?.full_name;
      const icon = slotTypeIcon(slot.slot_type_id);
      const title =
        calendarHealerFilter === 'all'
          ? `${icon} ${time} ${healerName(slot.healer_id)}${patientName ? ` - ${patientName}` : ''}`
          : `${icon} ${time} ${status.charAt(0).toUpperCase() + status.slice(1)}${patientName ? ` - ${patientName}` : ''}`;
      const shortTitle = `${icon} ${time}`;
      // Only worth a separate nickname line on mobile when slots from every
      // healer are mixed together - filtered to one healer it's redundant.
      const shortHealerName = calendarHealerFilter === 'all' ? healerName(slot.healer_id) : null;

      return {
        id: slot.id,
        title,
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        extendedProps: { status, shortTitle, shortHealerName },
      };
    });
  }

  async function verifyPayment(bookingId, paymentMethod, amount) {
    await supabase
      .from('bookings')
      .update({ status: 'booked', booked_at: new Date().toISOString() })
      .eq('id', bookingId);

    const parsedAmount = parseFloat(amount);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      const { error: payoutError } = await supabase.rpc('upsert_payout', {
        p_booking_id: bookingId,
        p_total_amount: parsedAmount,
      });
      if (payoutError) console.error('Failed to record payout split:', payoutError);
    }

    fetch('/api/send-booked-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    }).catch((err) => console.error('Failed to send booked email:', err));

    setSelectedSlotDetails(null);
    loadPending();
    loadAllBookings();
    loadCalendarSlots();
  }

  async function releaseBooking(bookingId, slotId, patientPackageId) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
    await supabase.from('slots').update({ is_booked: false }).eq('id', slotId);
    if (patientPackageId) {
      const { error } = await supabase.rpc('restore_package_session', {
        p_patient_package_id: patientPackageId,
      });
      if (error) console.error('Failed to restore package session:', error);
    }
    setSelectedSlotDetails(null);
    loadPending();
    loadAllBookings();
    loadCalendarSlots();
  }

  async function toggleHealerActive(userId, isActive) {
    await supabase
      .from('healer_profiles')
      .update({ is_active: !isActive })
      .eq('user_id', userId);
    loadHealers();
  }

  async function setHealerApproval(userId, status) {
    await supabase
      .from('healer_profiles')
      .update({ approval_status: status })
      .eq('user_id', userId);
    loadHealers();
  }

  async function loadPayouts() {
    setPayoutsLoading(true);
    const { data } = await supabase
      .from('payouts')
      .select(
        '*, bookings(patient_id, healer_id, delivery_preference, payment_method, slots(start_time, slot_type_id, slot_types(label)), profiles!bookings_patient_id_fkey(full_name), healer_profiles(profiles(full_name, nickname)))'
      )
      .order('created_at', { ascending: false });
    setPayouts(data || []);
    setPayoutsLoading(false);

    // Bookings confirmed before the payout feature existed (or otherwise
    // missed) never got a payout row created for them - find those so
    // admin can backfill them, rather than them silently never appearing.
    const payoutBookingIds = new Set((data || []).map((p) => p.booking_id));
    const { data: bookedData } = await supabase
      .from('bookings')
      .select(
        'id, delivery_preference, payment_method, amount, slots(start_time, slot_type_id, slot_types(label, price)), profiles!bookings_patient_id_fkey(full_name), healer_profiles(profiles(full_name, nickname))'
      )
      .in('status', ['booked', 'completed'])
      .order('created_at', { ascending: false });

    const missing = (bookedData || []).filter((b) => !payoutBookingIds.has(b.id));
    setMissingPayoutBookings(missing);
    setMissingAmounts((prev) => {
      const next = { ...prev };
      for (const b of missing) {
        if (next[b.id] === undefined) {
          next[b.id] = b.amount ?? b.slots?.slot_types?.price ?? '';
        }
      }
      return next;
    });
  }

  async function createMissingPayout(bookingId, amount) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      window.alert('Please enter a valid amount first.');
      return;
    }
    const { error } = await supabase.rpc('upsert_payout', {
      p_booking_id: bookingId,
      p_total_amount: parsedAmount,
    });
    if (error) {
      window.alert('Could not create the payout split. Please try again.');
      return;
    }
    loadPayouts();
  }

  async function markHealerPaid(payoutId, healerId, file) {
    setUploadingFor(payoutId);
    let proofPath = null;

    if (file) {
      const ext = file.name.split('.').pop();
      proofPath = `${healerId}/${payoutId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('healer-payout-proofs')
        .upload(proofPath, file);
      if (uploadError) {
        window.alert('Could not upload the payment screenshot. Please try again.');
        setUploadingFor(null);
        return;
      }
    }

    await supabase
      .from('payouts')
      .update({
        healer_paid: true,
        healer_paid_at: new Date().toISOString(),
        ...(proofPath ? { healer_payment_proof_url: proofPath } : {}),
      })
      .eq('id', payoutId);

    setUploadingFor(null);
    loadPayouts();
  }

  async function uploadPatientReceipt(payoutId, patientId, file) {
    if (!file) return;
    setUploadingFor(payoutId);

    const ext = file.name.split('.').pop();
    const receiptPath = `${patientId}/${payoutId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('patient-receipts')
      .upload(receiptPath, file);

    if (uploadError) {
      window.alert('Could not upload the receipt. Please try again.');
      setUploadingFor(null);
      return;
    }

    await supabase
      .from('payouts')
      .update({ patient_receipt_url: receiptPath, patient_receipt_sent_at: new Date().toISOString() })
      .eq('id', payoutId);

    setUploadingFor(null);
    loadPayouts();
  }

  const pendingHealers = healers.filter((h) => h.approval_status === 'pending');

  return (
    <div className="brand-page-wide space-y-6">
      <AppNav />

      <div>
        <h1 className="text-2xl font-display font-bold text-brand-green">Admin dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Approvals, the shared calendar, and everyone using Project HOPE — all in one place.
        </p>
      </div>

      {/* ============ SUMMARY TAB ============ */}
      {activeTab === 'summary' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="brand-card-tight text-center">
              <p className="text-2xl font-display font-bold text-brand-green">{healers.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Healers</p>
            </div>
            <div className="brand-card-tight text-center">
              <p className="text-2xl font-display font-bold text-brand-green">{patients.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Patients</p>
            </div>
            <div className="brand-card-tight text-center">
              <p className="text-2xl font-display font-bold text-amber-600">{pendingBookings.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Awaiting payment</p>
            </div>
            <div className="brand-card-tight text-center">
              <p className="text-2xl font-display font-bold text-amber-600">{pendingHealers.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Awaiting approval</p>
            </div>
          </div>

          <section>
            <h2 className="text-lg font-medium mb-3 text-brand-green">
              Pending Pranic Healer approvals ({pendingHealers.length})
            </h2>
            {pendingHealers.length === 0 && (
              <p className="brand-empty">No healers waiting on approval.</p>
            )}
            <ul className="space-y-2">
              {pendingHealers.map((h) => (
                <li key={h.user_id} className="brand-card-tight flex justify-between items-center">
                  <Link href={`/admin/healers/${h.user_id}`} className="flex-1">
                    <p className="font-medium text-brand-ink">
                      {h.profiles?.nickname || h.profiles?.full_name}
                    </p>
                    <p className="text-slate-500 text-sm">{h.specialty_summary || 'No specialty set'}</p>
                  </Link>
                  <div className="flex gap-2">
                    <button onClick={() => setHealerApproval(h.user_id, 'approved')} className="btn-primary btn-sm">
                      Approve
                    </button>
                    <button onClick={() => setHealerApproval(h.user_id, 'rejected')} className="btn-ghost btn-sm">
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3 text-brand-green">
              Pending payment verification ({pendingBookings.length})
            </h2>
            {pendingBookings.length === 0 && (
              <p className="brand-empty">No bookings waiting on payment verification.</p>
            )}
            <ul className="space-y-3">
              {pendingBookings.map((b) => (
                <li key={b.id} className="brand-card-tight space-y-2">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-brand-ink">
                        {b.profiles?.full_name} to {b.healer_profiles?.profiles?.nickname || b.healer_profiles?.profiles?.full_name}
                      </p>
                      <p className="text-slate-500 text-sm">
                        <span className="font-medium text-brand-ink">
                          {slotTypeIcon(b.slots?.slot_type_id)}{' '}
                          {sessionTypeLabel({
                            slotTypeId: b.slots?.slot_type_id,
                            deliveryPreference: b.delivery_preference,
                            paymentMethod: b.payment_method,
                          })}
                        </span>{' '}
                        — {new Date(b.slots?.start_time).toLocaleString()}
                      </p>
                      <p className="text-slate-500 capitalize text-sm">
                        Payment method: {b.payment_method?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {proofUrls[b.id] && (
                      <a
                        href={proofUrls[b.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-green underline text-xs h-fit whitespace-nowrap"
                      >
                        View proof of payment
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-500">Amount (₱)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmounts[b.id] ?? ''}
                      onChange={(e) =>
                        setPaymentAmounts((prev) => ({ ...prev, [b.id]: e.target.value }))
                      }
                      className="brand-input w-28 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => verifyPayment(b.id, b.payment_method, paymentAmounts[b.id])}
                      className="btn-primary btn-sm"
                    >
                      {['pay_at_office', 'package'].includes(b.payment_method) ? 'Confirm booking' : 'Verify and confirm booking'}
                    </button>
                    <button
                      onClick={() => releaseBooking(b.id, b.slot_id, b.patient_package_id)}
                      className="btn-ghost btn-sm"
                    >
                      Release slot (payment not received)
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3 text-brand-green">
              Pending package purchases ({pendingPackages.length})
            </h2>
            {pendingPackages.length === 0 && (
              <p className="brand-empty">No package purchases waiting on approval.</p>
            )}
            <ul className="space-y-3">
              {pendingPackages.map((p) => (
                <li key={p.id} className="brand-card-tight space-y-2">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-brand-ink">
                        {p.profiles?.full_name} — {p.packages?.name}
                      </p>
                      <p className="text-slate-500 text-sm">
                        ₱{Number(p.packages?.price).toLocaleString()} — {p.packages?.session_count} sessions
                      </p>
                      <p className="text-slate-500 capitalize text-sm">
                        Payment method: {p.payment_method?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {packageProofUrls[p.id] && (
                      <a
                        href={packageProofUrls[p.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-green underline text-xs h-fit whitespace-nowrap"
                      >
                        View proof of payment
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPackageApproval(p.id, 'booked')} className="btn-primary btn-sm">
                      Approve package
                    </button>
                    <button onClick={() => setPackageApproval(p.id, 'cancelled')} className="btn-ghost btn-sm">
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3 text-brand-green">Recent bookings (all statuses)</h2>
            <ul className="space-y-2">
              {allBookings.map((b) => {
                const fb = feedbackByBooking[b.id];
                return (
                  <li key={b.id} className="brand-card-tight space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-ink text-sm">
                        {slotTypeIcon(b.slots?.slot_type_id)}{' '}
                        {sessionTypeLabel({
                          slotTypeId: b.slots?.slot_type_id,
                          deliveryPreference: b.delivery_preference,
                          paymentMethod: b.payment_method,
                        })}{' '}
                        — {b.profiles?.full_name} with{' '}
                        {b.healer_profiles?.profiles?.nickname || b.healer_profiles?.profiles?.full_name} -{' '}
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

                    {b.status === 'completed' && (
                      <div className="flex items-center justify-between gap-2">
                        {fb ? (
                          <span className="text-amber-500 text-xs">
                            {'★'.repeat(fb.star_rating)}
                            {'☆'.repeat(5 - fb.star_rating)}
                            <span className="text-slate-400 ml-1">
                              Pain {fb.pain_scale}/10 · {fb.symptoms_improved_pct}% improved
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No feedback submitted yet.</span>
                        )}
                        <div className="flex items-center gap-3 shrink-0">
                          <a
                            href={`/patient/feedback/${b.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-green underline underline-offset-2 whitespace-nowrap"
                          >
                            View feedback page ↗
                          </a>
                          <button
                            onClick={() => copyFeedbackLink(b.id)}
                            className="text-xs text-brand-green underline underline-offset-2 whitespace-nowrap"
                          >
                            {copiedFeedbackId === b.id ? '✓ Link copied' : 'Copy feedback link'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              {allBookings.length === 0 && <p className="brand-empty">No bookings yet.</p>}
            </ul>
          </section>
        </div>
      )}

      {/* ============ CALENDAR TAB ============ */}
      {activeTab === 'calendar' && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-medium text-brand-green">Healer calendar</h2>
            <select
              value={calendarHealerFilter}
              onChange={(e) => setCalendarHealerFilter(e.target.value)}
              className="brand-select w-auto text-sm py-1.5 rounded-full"
            >
              <option value="all">All healers (combined)</option>
              {healers.map((h) => (
                <option key={h.user_id} value={h.user_id}>
                  {h.profiles?.nickname || h.profiles?.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-3">
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
            <span className="ml-2">🩺 Consultation</span>
            <span>🌿 Online Healing</span>
            <span>📍 Onsite (Ortigas)</span>
          </div>

          {calendarLoading ? (
            <p className="text-slate-500 text-sm">Loading calendar...</p>
          ) : calendarSlots.length === 0 ? (
            <p className="brand-empty">No slots found yet.</p>
          ) : (
            <div className="brand-card">
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
                events={buildCalendarEvents()}
                eventClassNames={(arg) => [`slot-status-${arg.event.extendedProps.status}`]}
                eventContent={(arg) => {
                  const compact = isMobile && arg.view.type === 'dayGridMonth';
                  const { shortTitle, shortHealerName } = arg.event.extendedProps;
                  return (
                    <div
                      title={arg.event.title}
                      className="px-1 py-0.5 text-[11px] leading-tight whitespace-normal break-words"
                    >
                      {compact && shortHealerName && (
                        <div className="font-semibold truncate">{shortHealerName}</div>
                      )}
                      {compact ? shortTitle : arg.event.title}
                    </div>
                  );
                }}
                eventClick={(info) => {
                  const slot = calendarSlots.find((s) => s.id === info.event.id);
                  if (slot) setSelectedSlotDetails(slot);
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* ============ HEALERS TAB ============ */}
      {activeTab === 'healers' && (
        <section>
          <h2 className="text-lg font-medium mb-3 text-brand-green">Pranic Healers ({healers.length})</h2>
          <ul className="space-y-2">
            {healers.map((h) => (
              <li
                key={h.user_id}
                className="brand-card-tight flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/admin/healers/${h.user_id}`} className="sm:flex-1 sm:min-w-0">
                  <span className="text-brand-ink font-medium">
                    {h.profiles?.nickname || h.profiles?.full_name}
                  </span>
                </Link>
                <div className="flex gap-2 items-center flex-wrap shrink-0">
                  <span
                    className={
                      h.approval_status === 'approved'
                        ? 'pill-available'
                        : h.approval_status === 'rejected'
                        ? 'pill-booked'
                        : 'pill-reserved'
                    }
                  >
                    {h.approval_status}
                  </span>
                  <button
                    onClick={() => toggleHealerActive(h.user_id, h.is_active)}
                    className={h.is_active ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm'}
                  >
                    {h.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <Link href={`/admin/healers/${h.user_id}`} className="btn-primary btn-sm">
                    View profile
                  </Link>
                </div>
              </li>
            ))}
            {healers.length === 0 && <p className="brand-empty">No healers yet.</p>}
          </ul>
        </section>
      )}

      {/* ============ PATIENTS TAB ============ */}
      {activeTab === 'patients' && (
        <section>
          <h2 className="text-lg font-medium mb-3 text-brand-green">Patients ({patients.length})</h2>
          <ul className="space-y-2">
            {patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/patients/${p.id}`}
                  className="brand-card-tight flex justify-between items-center gap-3 hover:border-brand-green/40 hover:bg-brand-mintSoft transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-brand-ink font-medium">
                      {p.nickname || p.full_name}
                    </span>
                    {p.reason_for_healing && (
                      <span className="text-slate-500 text-sm block truncate">{p.reason_for_healing}</span>
                    )}
                  </div>
                  <span
                    className={p.patient_status === 'active' ? 'pill-available shrink-0' : 'pill-neutral shrink-0'}
                  >
                    {p.patient_status || 'active'}
                  </span>
                </Link>
              </li>
            ))}
            {patients.length === 0 && <p className="brand-empty">No patients yet.</p>}
          </ul>
        </section>
      )}

      {/* ============ PAYMENTS TAB ============ */}
      {activeTab === 'payments' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-brand-green">Payments &amp; payout breakdown</h2>
            <p className="text-sm text-slate-500">
              Every confirmed booking's total is split 38% Pranic Healing Foundation of the
              Philippines / 38% the Pranic Healer / 6% referral / 18% Project HOPE admin. Set an
              amount when verifying a booking's payment to create its split here.
            </p>
          </div>

          {missingPayoutBookings.length > 0 && (
            <div className="brand-card space-y-3 border-amber-200 bg-amber-50/40">
              <div>
                <p className="font-medium text-amber-800">
                  {missingPayoutBookings.length} confirmed booking{missingPayoutBookings.length === 1 ? '' : 's'} missing a payout split
                </p>
                <p className="text-xs text-slate-500">
                  These were confirmed before an amount was recorded for them (e.g. before this
                  feature existed). Enter an amount for each to create its 38/38/6/18 split.
                </p>
              </div>
              <ul className="space-y-2">
                {missingPayoutBookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium text-brand-ink">{b.profiles?.full_name}</span>{' '}
                      <span className="text-slate-500">
                        with {b.healer_profiles?.profiles?.nickname || b.healer_profiles?.profiles?.full_name} —{' '}
                        {b.slots?.slot_types?.label} —{' '}
                        {b.slots?.start_time ? new Date(b.slots.start_time).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={missingAmounts[b.id] ?? ''}
                        onChange={(e) => setMissingAmounts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        className="brand-input w-24 py-1.5 text-sm"
                      />
                      <button onClick={() => createMissingPayout(b.id, missingAmounts[b.id])} className="btn-primary btn-sm">
                        Create split
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {payoutsLoading ? (
            <p className="text-slate-500 text-sm">Loading payments…</p>
          ) : payouts.length === 0 ? (
            <p className="brand-empty">
              No payment splits recorded yet — they're created when you verify a booking's payment
              with an amount, from the Summary tab.
            </p>
          ) : (
            <ul className="space-y-3">
              {payouts.map((p) => (
                <li key={p.id} className="brand-card space-y-3">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-medium text-brand-ink">
                        {p.bookings?.profiles?.full_name} with{' '}
                        {p.bookings?.healer_profiles?.profiles?.nickname ||
                          p.bookings?.healer_profiles?.profiles?.full_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        <span className="font-medium text-brand-ink">
                          {slotTypeIcon(p.bookings?.slots?.slot_type_id)}{' '}
                          {sessionTypeLabel({
                            slotTypeId: p.bookings?.slots?.slot_type_id,
                            deliveryPreference: p.bookings?.delivery_preference,
                            paymentMethod: p.bookings?.payment_method,
                          })}
                        </span>{' '}
                        —{' '}
                        {p.bookings?.slots?.start_time
                          ? new Date(p.bookings.slots.start_time).toLocaleString()
                          : '—'}
                      </p>
                    </div>
                    <p className="text-lg font-display font-bold text-brand-green">
                      ₱{Number(p.total_amount).toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SPLIT_LABELS.map((s) => (
                      <div key={s.key} className="bg-brand-mintSoft rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500">
                          {s.label} ({s.pct})
                        </p>
                        <p className="text-sm font-semibold text-brand-ink">
                          ₱{Number(p[s.key]).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    {/* Healer payout status */}
                    <div className="pt-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">
                        Healer's 38% (₱{Number(p.healer_amount).toLocaleString()})
                      </p>
                      {p.healer_paid ? (
                        <div className="text-sm space-y-1">
                          <span className="pill-available">✅ Paid</span>
                          <p className="text-xs text-slate-400">
                            {p.healer_paid_at && new Date(p.healer_paid_at).toLocaleString()}
                          </p>
                          {p.healer_payment_proof_url && (
                            <ProofLink bucket="healer-payout-proofs" path={p.healer_payment_proof_url} label="View proof sent" />
                          )}
                        </div>
                      ) : (
                        <label className="btn-secondary btn-sm cursor-pointer inline-flex">
                          {uploadingFor === p.id ? 'Uploading…' : 'Mark paid + upload proof'}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={uploadingFor === p.id}
                            onChange={(e) =>
                              markHealerPaid(p.id, p.bookings?.healer_id, e.target.files?.[0] || null)
                            }
                          />
                        </label>
                      )}
                    </div>

                    {/* Patient receipt */}
                    <div className="pt-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Patient receipt</p>
                      {p.patient_receipt_url ? (
                        <div className="text-sm space-y-1">
                          <span className="pill-available">✅ Sent</span>
                          <p className="text-xs text-slate-400">
                            {p.patient_receipt_sent_at &&
                              new Date(p.patient_receipt_sent_at).toLocaleString()}
                          </p>
                          <ProofLink bucket="patient-receipts" path={p.patient_receipt_url} label="View receipt sent" />
                        </div>
                      ) : (
                        <label className="btn-secondary btn-sm cursor-pointer inline-flex">
                          {uploadingFor === p.id ? 'Uploading…' : 'Upload receipt'}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={uploadingFor === p.id}
                            onChange={(e) =>
                              uploadPatientReceipt(p.id, p.bookings?.patient_id, e.target.files?.[0] || null)
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ============ INTERACTIVE TAB ============ */}
      {activeTab === 'interactive' && (
        <section className="space-y-10">
          <div>
            <h2 className="text-lg font-medium text-brand-green mb-1">Live form previews</h2>
            <p className="text-sm text-slate-500">
              These are the exact same forms your patients and healers fill out — fully
              interactive, so you can review the fields and wording as they'll actually see them.
              Nothing entered here is saved anywhere.
            </p>
          </div>

          <div>
            <h3 className="text-base font-medium text-brand-ink mb-3">
              🌿 Patient Feedback Form
            </h3>
            <PatientFeedbackPreview />
          </div>

          <div>
            <h3 className="text-base font-medium text-brand-ink mb-3">
              📝 Healer Session Notes (Chakra Observation)
            </h3>
            <HealerNotePreview />
          </div>
        </section>
      )}

      {/* Slot details modal - shown when an admin clicks an event on the calendar */}
      {selectedSlotDetails && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-brandLg my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-display font-bold text-brand-green">Slot details</h3>
              <button
                onClick={() => setSelectedSlotDetails(null)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0 -mt-1"
              >
                ✕
              </button>
            </div>
            <div className="text-sm space-y-1">
              <p className="text-brand-ink font-medium">{healerName(selectedSlotDetails.healer_id)}</p>
              <p className="text-slate-500">
                <span className="font-medium text-brand-ink">
                  {slotTypeIcon(selectedSlotDetails.slot_type_id)}{' '}
                  {sessionTypeLabel({
                    slotTypeId: selectedSlotDetails.slot_type_id,
                    deliveryPreference: selectedSlotDetails.booking?.delivery_preference,
                    paymentMethod: selectedSlotDetails.booking?.payment_method,
                  })}
                </span>{' '}
                - {new Date(selectedSlotDetails.start_time).toLocaleString()}
              </p>
              <p className="capitalize text-slate-500">
                Status: {getSlotStatus(selectedSlotDetails)}
              </p>
            </div>

            {selectedSlotDetails.booking ? (
              <div className="text-sm border-t pt-3 space-y-1">
                <p className="text-brand-ink font-medium">
                  {selectedSlotDetails.booking.profiles?.full_name || 'Patient'}
                </p>
                {selectedSlotDetails.booking.profiles?.phone && (
                  <p className="text-slate-500">{selectedSlotDetails.booking.profiles.phone}</p>
                )}
                <p className="text-slate-500 capitalize">
                  Payment method: {selectedSlotDetails.booking.payment_method?.replace(/_/g, ' ')}
                  {selectedSlotDetails.booking.delivery_preference && (
                    <>
                      {' '}
                      -{' '}
                      {selectedSlotDetails.booking.delivery_preference === 'online_realtime'
                        ? 'Online Real-Time'
                        : 'Distant Healing'}
                    </>
                  )}
                </p>

                {selectedSlotDetails.booking.main_concern && (
                  <p className="text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <span className="font-medium">Main concern:</span> {selectedSlotDetails.booking.main_concern}
                  </p>
                )}
                {selectedSlotDetails.booking.pain_level_before !== null && selectedSlotDetails.booking.pain_level_before !== undefined && (
                  <p className="text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <span className="font-medium">Pain level before:</span> {selectedSlotDetails.booking.pain_level_before} / 10
                  </p>
                )}

                {selectedSlotDetails.booking.status === 'reserved' && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        const defaultAmount =
                          selectedSlotDetails.booking.amount ??
                          selectedSlotDetails.slot_types?.price ??
                          '';
                        const amount = window.prompt('Total amount for this session (₱):', defaultAmount);
                        if (amount === null) return;
                        verifyPayment(
                          selectedSlotDetails.booking.id,
                          selectedSlotDetails.booking.payment_method,
                          amount
                        );
                      }}
                      className="btn-primary btn-sm"
                    >
                      {['pay_at_office', 'package'].includes(selectedSlotDetails.booking.payment_method)
                        ? 'Confirm booking'
                        : 'Verify and confirm booking'}
                    </button>
                    <button
                      onClick={() =>
                        releaseBooking(
                          selectedSlotDetails.booking.id,
                          selectedSlotDetails.id,
                          selectedSlotDetails.booking.patient_package_id
                        )
                      }
                      className="btn-ghost btn-sm"
                    >
                      Release slot
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 border-t pt-3">This slot is open - no booking yet.</p>
            )}

            <div className="flex justify-end">
              <button onClick={() => setSelectedSlotDetails(null)} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500 text-sm">Loading...</div>}>
      <AdminDashboardInner />
    </Suspense>
  );
}
