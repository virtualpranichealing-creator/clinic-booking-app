'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';

export default function HealerPatientsPage() {
  const [patients, setPatients] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('bookings')
      .select('patient_id, status, created_at, profiles!bookings_patient_id_fkey(full_name, reason_for_healing, patient_status, avatar_url)')
      .eq('healer_id', user.id)
      .in('status', ['booked', 'completed', 'no_show'])
      .order('created_at', { ascending: false });

    // De-duplicate to one row per patient
    const seen = new Map();
    for (const b of data || []) {
      if (!seen.has(b.patient_id)) {
        seen.set(b.patient_id, b);
      }
    }
    const patientList = Array.from(seen.values());
    setPatients(patientList);

    // Generate signed URLs for each patient's photo (private bucket)
    const urls = {};
    for (const p of patientList) {
      if (p.profiles?.avatar_url) {
        const { data: signed } = await supabase.storage
          .from('patient-photos')
          .createSignedUrl(p.profiles.avatar_url, 3600);
        if (signed) urls[p.patient_id] = signed.signedUrl;
      }
    }
    setPhotoUrls(urls);
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <AppNav />
      <h1 className="text-2xl font-semibold">My Patients</h1>

      <ul className="space-y-2">
        {patients.length === 0 && (
          <p className="text-sm text-slate-500">
            No patients yet — this list fills in once you have booked or completed sessions.
          </p>
        )}
        {patients.map((p) => (
          <li key={p.patient_id}>
            <Link
              href={`/healer/patients/${p.patient_id}`}
              className="block border rounded-lg p-4 hover:border-slate-500"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {photoUrls[p.patient_id] && (
                    <img
                      src={photoUrls[p.patient_id]}
                      alt={p.profiles?.full_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium">{p.profiles?.full_name}</p>
                    {p.profiles?.reason_for_healing && (
                      <p className="text-sm text-slate-500">{p.profiles.reason_for_healing}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    p.profiles?.patient_status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p.profiles?.patient_status || 'active'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
