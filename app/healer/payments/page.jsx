'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';

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

export default function HealerPaymentsPage() {
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
        '*, bookings!inner(healer_id, slots(start_time, slot_types(label)), profiles!bookings_patient_id_fkey(full_name, nickname))'
      )
      .eq('bookings.healer_id', user.id)
      .order('created_at', { ascending: false });

    setPayouts(data || []);
    setLoading(false);
  }

  const totalPaid = payouts.filter((p) => p.healer_paid).reduce((sum, p) => sum + Number(p.healer_amount), 0);
  const totalPending = payouts.filter((p) => !p.healer_paid).reduce((sum, p) => sum + Number(p.healer_amount), 0);

  return (
    <div className="brand-page-wide space-y-6">
      <AppNav />

      <div>
        <h1 className="text-2xl font-display font-bold text-brand-green">My Payments</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your 38% share from every confirmed session, and whether it's been sent to you yet.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <div className="brand-card-tight text-center">
          <p className="text-xl font-display font-bold text-brand-green">
            ₱{totalPaid.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Received</p>
        </div>
        <div className="brand-card-tight text-center">
          <p className="text-xl font-display font-bold text-amber-600">
            ₱{totalPending.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Pending</p>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading your payments…</p>
      ) : payouts.length === 0 ? (
        <p className="brand-empty">
          No payments recorded yet — these appear once admin confirms a session's payment.
        </p>
      ) : (
        <ul className="space-y-3">
          {payouts.map((p) => (
            <li key={p.id} className="brand-card flex flex-wrap justify-between items-center gap-3">
              <div>
                <p className="font-medium text-brand-ink">
                  {p.bookings?.profiles?.nickname || p.bookings?.profiles?.full_name}
                </p>
                <p className="text-sm text-slate-500">
                  {p.bookings?.slots?.slot_types?.label} —{' '}
                  {p.bookings?.slots?.start_time
                    ? new Date(p.bookings.slots.start_time).toLocaleString()
                    : '—'}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-lg font-display font-bold text-brand-green">
                  ₱{Number(p.healer_amount).toLocaleString()}
                </p>
                {p.healer_paid ? (
                  <>
                    <span className="pill-available">✅ Sent {p.healer_paid_at && new Date(p.healer_paid_at).toLocaleDateString()}</span>
                    {p.healer_payment_proof_url && (
                      <div>
                        <ProofLink bucket="healer-payout-proofs" path={p.healer_payment_proof_url} label="View proof" />
                      </div>
                    )}
                  </>
                ) : (
                  <span className="pill-reserved">Pending</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
