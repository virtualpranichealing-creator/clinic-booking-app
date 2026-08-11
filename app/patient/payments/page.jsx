'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';
import { fetchHealerNames } from '../../../lib/healerNames';

function ReceiptLink({ path }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleClick(e) {
    e.preventDefault();
    if (url) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }
    setLoading(true);
    const { data } = await supabase.storage.from('patient-receipts').createSignedUrl(path, 3600);
    setLoading(false);
    if (data) {
      setUrl(data.signedUrl);
      window.open(data.signedUrl, '_blank', 'noreferrer');
    }
  }

  return (
    <button onClick={handleClick} className="btn-secondary btn-sm">
      {loading ? 'Loading…' : 'View / download receipt'}
    </button>
  );
}

export default function PatientPaymentsPage() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayouts();
  }, []);

  async function loadPayouts() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('payouts')
      .select(
        '*, bookings!inner(patient_id, healer_id, slots(start_time, slot_types(label)))'
      )
      .eq('bookings.patient_id', user.id)
      .order('created_at', { ascending: false });

    const namesById = await fetchHealerNames(supabase, (data || []).map((p) => p.bookings?.healer_id));
    const withNames = (data || []).map((p) => ({
      ...p,
      bookings: { ...p.bookings, healer_profiles: { profiles: namesById[p.bookings?.healer_id] } },
    }));

    setPayouts(withNames);
    setLoading(false);
  }

  return (
    <div className="brand-page space-y-6">
      <AppNav />

      <div>
        <h1 className="text-2xl font-display font-bold text-brand-green">My Payments</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Every payment you've made for a session, and its receipt once we've sent it.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading your payments…</p>
      ) : payouts.length === 0 ? (
        <p className="brand-empty">No payments recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {payouts.map((p) => (
            <li key={p.id} className="brand-card space-y-2">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-ink">
                    {p.bookings?.slots?.slot_types?.label} with{' '}
                    {p.bookings?.healer_profiles?.profiles?.nickname ||
                      p.bookings?.healer_profiles?.profiles?.full_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {p.bookings?.slots?.start_time
                      ? new Date(p.bookings.slots.start_time).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <p className="text-lg font-display font-bold text-brand-green">
                  ₱{Number(p.total_amount).toLocaleString()}
                </p>
              </div>

              {p.patient_receipt_url ? (
                <div className="flex items-center gap-3 pt-1">
                  <span className="pill-available">✅ Receipt sent</span>
                  <ReceiptLink path={p.patient_receipt_url} />
                </div>
              ) : (
                <p className="text-xs text-slate-400 pt-1">
                  Your receipt is being prepared and will appear here shortly.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
