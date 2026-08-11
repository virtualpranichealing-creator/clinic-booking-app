'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';
import { TIMEZONE_OPTIONS, loadStoredTimezone, storeTimezone } from '../../../lib/timezone';
import { slotTypeIcon } from '../../../lib/slotTypeIcons';
import { useIsMobile } from '../../../lib/useIsMobile';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const STATUS_COLORS = {
  available: { bg: '#3D6B4A', border: '#2f5439' },
  reserved: { bg: '#ca8a04', border: '#a16207' },
  booked: { bg: '#dc2626', border: '#b91c1c' },
};

export default function HealerCalendarPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const isMobile = useIsMobile();

  const [timezone, setTimezone] = useState('Asia/Manila');
  useEffect(() => {
    setTimezone(loadStoredTimezone());
  }, []);
  function handleTimezoneChange(tz) {
    setTimezone(tz);
    storeTimezone(tz);
  }

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: slotsData } = await supabase
      .from('slots')
      .select('*, slot_types(label, duration_minutes)')
      .eq('healer_id', user.id)
      .order('start_time');

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, slot_id, status, payment_method, delivery_preference, main_concern, profiles!bookings_patient_id_fkey(full_name, phone)')
      .eq('healer_id', user.id)
      .in('status', ['reserved', 'booked']);

    const bookingBySlot = {};
    (bookingsData || []).forEach((b) => {
      bookingBySlot[b.slot_id] = b;
    });

    setSlots((slotsData || []).map((s) => ({ ...s, booking: bookingBySlot[s.id] || null })));
    setLoading(false);
  }

  function getStatus(slot) {
    if (slot.booking?.status === 'booked') return 'booked';
    if (slot.booking?.status === 'reserved') return 'reserved';
    return slot.current_status && slot.current_status !== 'available' ? slot.current_status : 'available';
  }

  function buildEvents() {
    return slots.map((slot) => {
      const status = getStatus(slot);
      const colors = STATUS_COLORS[status];
      const time = new Date(slot.start_time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: slot.slot_type_id === 'physical_healing' ? 'Asia/Manila' : timezone,
      });
      const icon = slotTypeIcon(slot.slot_type_id);
      const patientName = slot.booking?.profiles?.full_name;
      const title = `${icon} ${time} ${status.charAt(0).toUpperCase() + status.slice(1)}${patientName ? ` - ${patientName}` : ''}`;
      const shortTitle = `${icon} ${time}`;

      return {
        id: slot.id,
        title,
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        extendedProps: { shortTitle },
      };
    });
  }

  async function markStatus(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId);
    setSelected(null);
    loadCalendar();
  }

  async function blockSlot(slotId) {
    await supabase.from('slots').delete().eq('id', slotId).eq('is_booked', false);
    setSelected(null);
    loadCalendar();
  }

  return (
    <div className="brand-page-wide space-y-6">
      <AppNav />

      <div>
        <h1 className="text-2xl font-display font-bold text-brand-green">My Calendar</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Every slot you've opened, at a glance — green is open, yellow is reserved, red is booked.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
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
      <p className="text-[11px] text-slate-400 text-right -mt-4">
        📍 Onsite (Ortigas) slots always show Philippine time.
      </p>

      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
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

      {loading ? (
        <p className="text-slate-500 text-sm">Loading your calendar…</p>
      ) : slots.length === 0 ? (
        <p className="brand-empty">
          No slots yet — add your weekly availability from the "Availability &amp; Bookings" tab, then
          generate slots to see them here.
        </p>
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
            events={buildEvents()}
            eventContent={(arg) => {
              const compact = isMobile && arg.view.type === 'dayGridMonth';
              return (
                <div title={arg.event.title} className="px-1 py-0.5 text-[11px] leading-tight whitespace-normal break-words">
                  {compact ? arg.event.extendedProps.shortTitle : arg.event.title}
                </div>
              );
            }}
            eventClick={(info) => {
              const slot = slots.find((s) => s.id === info.event.id);
              if (slot) setSelected(slot);
            }}
          />
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-brandLg my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-display font-bold text-brand-green">Slot details</h3>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0 -mt-1"
              >
                ✕
              </button>
            </div>
            <div className="text-sm space-y-1">
              <p className="text-brand-ink font-medium">
                {selected.slot_types?.label}
                {selected.slot_type_id === 'physical_healing' && ' 📍'}
              </p>
              <p className="text-slate-500">
                {new Date(selected.start_time).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: selected.slot_type_id === 'physical_healing' ? 'Asia/Manila' : timezone,
                })}
              </p>
              <p className="capitalize text-slate-500">Status: {getStatus(selected)}</p>
            </div>

            {selected.booking ? (
              <div className="text-sm border-t pt-3 space-y-1">
                <p className="text-brand-ink font-medium">{selected.booking.profiles?.full_name}</p>
                {selected.booking.profiles?.phone && (
                  <p className="text-slate-500">{selected.booking.profiles.phone}</p>
                )}
                <p className="text-slate-500 capitalize">
                  {selected.booking.payment_method?.replace(/_/g, ' ')}
                  {selected.booking.delivery_preference && (
                    <> - {selected.booking.delivery_preference === 'online_realtime' ? 'Online Real-Time' : 'Distant Healing'}</>
                  )}
                </p>

                {selected.booking.main_concern && (
                  <p className="text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <span className="font-medium">Main concern:</span> {selected.booking.main_concern}
                  </p>
                )}

                {selected.booking.status === 'booked' && (
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => markStatus(selected.booking.id, 'completed')} className="btn-primary btn-sm">
                      Mark completed
                    </button>
                    <button onClick={() => markStatus(selected.booking.id, 'no_show')} className="btn-ghost btn-sm">
                      Mark no-show
                    </button>
                  </div>
                )}
                {selected.booking.status === 'reserved' && (
                  <p className="text-xs text-slate-400 pt-1">
                    Awaiting payment verification from the admin team.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-sm border-t pt-3 space-y-2">
                <p className="text-slate-500">This slot is open — no booking yet.</p>
                <button onClick={() => blockSlot(selected.id)} className="btn-ghost btn-sm">
                  Remove this slot
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setSelected(null)} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
