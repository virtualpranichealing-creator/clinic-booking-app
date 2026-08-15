'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import PatientNav from '../../../components/PatientNav';

export default function PatientPackagesPage() {
  const [packages, setPackages] = useState([]);
  const [myPackages, setMyPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [buying, setBuying] = useState(null); // package id currently being purchased
  const [paymentMethod, setPaymentMethod] = useState('qr_maribank');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data: pkgs } = await supabase
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .order('session_count');
    setPackages(pkgs || []);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: mine } = await supabase
        .from('patient_packages')
        .select('*, packages(name, session_count, price)')
        .eq('patient_id', user.id)
        .order('purchased_at', { ascending: false });
      setMyPackages(mine || []);
    }
    setLoading(false);
  }

  function startBuying(pkgId) {
    setBuying(pkgId);
    setPaymentMethod('qr_maribank');
    setProofFile(null);
    setError(null);
  }

  async function submitPurchase(pkg) {
    if (!proofFile) {
      setError('Please upload your proof of payment before submitting.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    const fileExt = proofFile.name.split('.').pop();
    const filePath = `${user.id}/package-${pkg.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, proofFile);

    if (uploadError) {
      setError('Could not upload your payment proof. Please try again.');
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('patient_packages').insert({
      patient_id: user.id,
      package_id: pkg.id,
      sessions_remaining: pkg.session_count,
      payment_status: 'reserved',
      payment_method: paymentMethod,
      payment_proof_url: filePath,
    });

    if (insertError) {
      setError('Could not record your purchase. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setBuying(null);
    loadAll();
  }

  return (
    <div className="brand-page-wide space-y-8">
      <PatientNav />

      <div>
        <h1 className="text-2xl font-display font-bold text-brand-green">Packages</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Buy a package upfront, then book your sessions on the calendar whenever you like — just
          choose "Use my package" instead of paying each time.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {packages.map((pkg) => (
            <div key={pkg.id} className="brand-shell">
              <div className="relative z-10 text-center">
                <p className="text-lg font-display font-bold text-brand-ink">{pkg.name}</p>
                <p className="text-3xl font-display font-bold text-brand-green mt-1">
                  ₱{Number(pkg.price).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">{pkg.description}</p>

                {buying === pkg.id ? (
                  <div className="mt-5 text-left space-y-3">
                    <div>
                      <label className="brand-label">Payment method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="brand-select"
                      >
                        <option value="qr_maribank">QR / Maribank</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </div>
                    <div>
                      <label className="brand-label">Upload proof of payment</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        className="w-full text-sm"
                      />
                    </div>
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitPurchase(pkg)}
                        disabled={submitting}
                        className="btn-primary btn-sm flex-1"
                      >
                        {submitting ? 'Submitting…' : 'Submit purchase'}
                      </button>
                      <button onClick={() => setBuying(null)} className="btn-ghost btn-sm">
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Your package will be marked "Pending" until admin confirms your payment.
                    </p>
                  </div>
                ) : (
                  <button onClick={() => startBuying(pkg.id)} className="btn-primary mt-5">
                    Buy this package
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium text-brand-green mb-3">My packages</h2>
        {myPackages.length === 0 ? (
          <p className="brand-empty">You haven't purchased a package yet.</p>
        ) : (
          <ul className="space-y-2">
            {myPackages.map((p) => (
              <li key={p.id} className="brand-card-tight flex justify-between items-center gap-3">
                <div>
                  <p className="font-medium text-brand-ink">{p.packages?.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.payment_status === 'booked'
                      ? `${p.sessions_remaining} of ${p.packages?.session_count} sessions left`
                      : `₱${Number(p.packages?.price).toLocaleString()}`}
                  </p>
                </div>
                <span
                  className={
                    p.payment_status === 'booked'
                      ? 'pill-available'
                      : p.payment_status === 'cancelled'
                      ? 'pill-booked'
                      : 'pill-reserved'
                  }
                >
                  {p.payment_status === 'booked' ? 'Active' : p.payment_status === 'cancelled' ? 'Cancelled' : 'Pending approval'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
