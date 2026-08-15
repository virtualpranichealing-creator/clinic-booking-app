'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AppNav from '../../components/AppNav';

export default function ServicesPage() {
  const [role, setRole] = useState(null);
  const [packages, setPackages] = useState([]);
  const [myPackages, setMyPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [buying, setBuying] = useState(null);
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
    // Safety net in case duplicate rows still exist from before the
    // database fix - only ever show one card per session count.
    const seen = new Set();
    const deduped = (pkgs || []).filter((p) => {
      if (seen.has(p.session_count)) return false;
      seen.add(p.session_count);
      return true;
    });
    setPackages(deduped);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setRole(profile?.role || null);

      if (profile?.role === 'patient') {
        const { data: mine } = await supabase
          .from('patient_packages')
          .select('*, packages(name, session_count, price)')
          .eq('patient_id', user.id)
          .order('purchased_at', { ascending: false });
        setMyPackages(mine || []);
      }
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

    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, proofFile);
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

  const threeSession = packages.find((p) => p.session_count === 3);
  const sixSession = packages.find((p) => p.session_count === 6);

  return (
    <div className="min-h-screen">
      <AppNav />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="brand-heading-script">Our Services</h1>
          <p className="text-sm text-slate-500 mt-2">
            Simple, transparent pricing for every kind of Pranic Healing session we offer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Consultation */}
          <div className="brand-shell">
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-3xl mb-1">🩺</p>
                  <h2 className="text-xl font-display font-bold text-brand-green">Consultation</h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-display font-bold text-brand-green">₱500</p>
                  <p className="text-xs text-slate-400">/ session</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                A focused energetic assessment with a Pranic Healer to understand what's going on
                and what kind of healing support fits your situation.
              </p>

              <div className="bg-brand-mintSoft rounded-xl p-4">
                <p className="text-sm font-semibold text-brand-ink mb-0.5">✨ Want something personalized?</p>
                <p className="text-xs text-slate-600">
                  Book a consultation to design a personalized healing program tailored to your
                  specific needs, together with your healer.
                </p>
              </div>
            </div>
          </div>

          {/* Pranic Healing Session + Packages */}
          <div className="brand-shell">
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-3xl mb-1">🌿</p>
                  <h2 className="text-xl font-display font-bold text-brand-green">Pranic Healing Session</h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-display font-bold text-brand-green">₱2,500</p>
                  <p className="text-xs text-slate-400">/ session</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                A full Pranic Healing session, available in whichever format works best for you:
              </p>

              <div className="space-y-3 mb-5">
                <div className="bg-brand-mintSoft rounded-xl p-4">
                  <p className="text-sm font-semibold text-brand-ink mb-0.5">🌐 Online / Distant Pranic Healing</p>
                  <p className="text-xs text-slate-600">
                    Join live over video, or rest in a quiet space at home while your healer
                    performs distant healing at your scheduled time.
                  </p>
                </div>
                <div className="bg-brand-mintSoft rounded-xl p-4">
                  <p className="text-sm font-semibold text-brand-ink mb-0.5">📍 Physical Pranic Healing Session</p>
                  <p className="text-xs text-slate-600">
                    An in-person session at the PHFP Ortigas Center, Tuesday–Friday, 2:00–5:00 PM.
                    Payment is settled at the office.
                  </p>
                </div>
              </div>

              <div className="text-center mb-5">
                <a
                  href="/patient/healers"
                  className="text-sm text-brand-green underline underline-offset-2 font-medium"
                >
                  Browse Pranic Healers →
                </a>
              </div>

              <div className="border-t border-brand-mint/60 pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-green/80 mb-3">
                  📦 Or save with a package
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-brand-green/20 bg-white p-4 text-center">
                    <p className="text-lg font-display font-bold text-brand-ink">3 Sessions</p>
                    <p className="text-xl font-display font-bold text-brand-green mt-1">₱7,000</p>
                    <span className="inline-block mt-2 text-xs font-medium text-brand-green bg-brand-mint rounded-full px-2.5 py-0.5">
                      🎁 + Bonus Healing Kit
                    </span>
                  </div>
                  <div className="rounded-xl border border-brand-green/20 bg-white p-4 text-center">
                    <p className="text-lg font-display font-bold text-brand-ink">6 Sessions</p>
                    <p className="text-xl font-display font-bold text-brand-green mt-1">₱14,000</p>
                    <span className="inline-block mt-2 text-xs font-medium text-brand-green bg-brand-mint rounded-full px-2.5 py-0.5">
                      🎁 + Bonus Healing Kit
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!role && (
          <div className="text-center pt-4">
            <Link href="/signup" className="btn-primary inline-block">
              Book your first session
            </Link>
            <p className="text-xs text-slate-400 mt-3">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-green underline underline-offset-2">
                Log in
              </Link>{' '}
              to book.
            </p>
          </div>
        )}

        {role && (
          <div className="text-center pt-2">
            <Link href="/patient" className="btn-primary inline-block">
              📅 Book a Session
            </Link>
            <p className="text-xs text-slate-400 mt-2">
              Ready to book? Head to the calendar and pick a time that works for you.
            </p>
          </div>
        )}

        {/* Package purchasing stays patient-only - it's a billing concept
            tied to a patient's own account, not something a healer/admin
            would use for themselves. */}
        {role === 'patient' && (
          <div className="space-y-8 pt-4 border-t border-slate-100">
            <div>
              <h2 className="text-xl font-display font-bold text-brand-green mb-1">Buy a Package</h2>
              <p className="text-sm text-slate-500">
                Buy upfront, then book your sessions on the calendar whenever you like — just
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
        )}
      </main>
    </div>
  );
}
