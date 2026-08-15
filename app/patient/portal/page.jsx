'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';
import { fetchHealerNames } from '../../../lib/healerNames';

const CONSENT_TEXT = `I, the person filling out this form, understand that Pranic Healing is not meant to replace conventional medicine but rather to complement it. If symptoms persist, a medical professional is to be consulted immediately.

I am voluntarily participating in this Pranic Healing Treatment. I consent to the collection and use of my personal and health information for my Pranic Healing Treatment, Administrative needs and for Certification of the assigned Pranic Healer.

I hereby release the person(s) and/or the Pranic Healing organization from any liability as a result of the services received by me. The protected information provided will be dealt with sensitivity and in strict confidence, and may be disclosed or used for therapy and quality improvement.`;

export default function PatientPortalPage() {
  const [loading, setLoading] = useState(true);
  const [photoSignedUrl, setPhotoSignedUrl] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [nextSession, setNextSession] = useState(null);
  const [latestNote, setLatestNote] = useState(null);

  // Profile form state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [reasonForHealing, setReasonForHealing] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [alreadyConsented, setAlreadyConsented] = useState(false);
  const [ndaAgreedAt, setNdaAgreedAt] = useState(null);
  const [patientStatus, setPatientStatus] = useState('active');
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    loadEverything();
  }, []);

  async function loadEverything() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setEmail(profileData.email || user.email || '');
      setFirstName(profileData.first_name || '');
      setLastName(profileData.last_name || '');
      setNickname(profileData.nickname || '');
      setMobile(profileData.mobile || '');
      setAge(profileData.age || '');
      setGender(profileData.gender || '');
      setReasonForHealing(profileData.reason_for_healing || '');
      setConsentChecked(!!profileData.consent_agreed);
      setAlreadyConsented(!!profileData.consent_agreed);
      setNdaAgreedAt(profileData.nda_agreed_at || null);
      setPatientStatus(profileData.patient_status || 'active');

      if (profileData.avatar_url) {
        const { data: signed } = await supabase.storage
          .from('patient-photos')
          .createSignedUrl(profileData.avatar_url, 3600);
        if (signed) setPhotoSignedUrl(signed.signedUrl);
      }
    }

    const now = new Date().toISOString();

    const { data: last } = await supabase
      .from('bookings')
      .select('*, slots(start_time)')
      .eq('patient_id', user.id)
      .neq('status', 'cancelled')
      .lt('slots.start_time', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: next } = await supabase
      .from('bookings')
      .select('*, slots(start_time)')
      .eq('patient_id', user.id)
      .in('status', ['reserved', 'booked'])
      .gte('slots.start_time', now)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: note } = await supabase
      .from('session_notes')
      .select('*, healer_id, observation_items(*, chakras(label))')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // profiles' RLS only allows reading your own row, so a healer's name has
    // to come through this narrow public view instead of a direct join.
    const namesById = await fetchHealerNames(
      supabase,
      [last?.healer_id, next?.healer_id, note?.healer_id]
    );
    setLastSession(last ? { ...last, healer_profiles: { profiles: namesById[last.healer_id] } } : null);
    setNextSession(next ? { ...next, healer_profiles: { profiles: namesById[next.healer_id] } } : null);
    setLatestNote(note ? { ...note, healer_profiles: { profiles: namesById[note.healer_id] } } : null);

    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!photoSignedUrl && !photoFile) {
      setError('Please add a profile photo before saving.');
      return;
    }
    if (!mobile.trim()) {
      setError('Please add your phone number before saving.');
      return;
    }
    if (!consentChecked) {
      setError('Please read and check the consent agreement to save your profile.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop();
      const filePath = `${user.id}/photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('patient-photos')
        .upload(filePath, photoFile, { upsert: true });

      if (uploadError) {
        setError('Could not upload your photo. Please try again.');
        setSaving(false);
        return;
      }
      await supabase.from('profiles').update({ avatar_url: filePath }).eq('id', user.id);
      const { data: signed } = await supabase.storage
        .from('patient-photos')
        .createSignedUrl(filePath, 3600);
      if (signed) setPhotoSignedUrl(signed.signedUrl);
      setPhotoFile(null);
    }

    await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        nickname,
        mobile,
        age: age ? Number(age) : null,
        gender: gender || null,
        reason_for_healing: reasonForHealing,
        full_name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
        consent_agreed: true,
        consent_agreed_at: alreadyConsented ? undefined : new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    setSaved(true);
    setAlreadyConsented(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="brand-page">
        <AppNav />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="brand-page space-y-8">
      <AppNav />
      <h1 className="text-2xl font-display font-bold text-brand-green">My Portal</h1>

      {!alreadyConsented && (
        <div className="brand-shell text-center py-8">
          <p className="font-script text-4xl text-brand-green mb-2">One quick step first</p>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Please fill in and save your profile below before booking a session — it only takes a
            minute.
          </p>
        </div>
      )}

      {alreadyConsented && (
        <>
          <section className="brand-card space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {photoSignedUrl && (
                  <img
                    src={photoSignedUrl}
                    alt={nickname || firstName}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="text-lg font-medium text-brand-ink">
                    {nickname || [firstName, lastName].filter(Boolean).join(' ')}
                  </p>
                  {reasonForHealing && (
                    <p className="text-sm text-slate-500">Main concern: {reasonForHealing}</p>
                  )}
                </div>
              </div>
              <span className={patientStatus === 'active' ? 'pill-available' : 'pill-neutral'}>
                {patientStatus === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm pt-2">
              <div>
                <p className="text-slate-500">Last session</p>
                <p className="text-brand-ink">
                  {lastSession
                    ? `${new Date(lastSession.slots?.start_time).toLocaleDateString()} with ${
                        lastSession.healer_profiles?.profiles?.nickname ||
                        lastSession.healer_profiles?.profiles?.full_name
                      }`
                    : 'None yet'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Next session</p>
                <p className="text-brand-ink">
                  {nextSession
                    ? `${new Date(nextSession.slots?.start_time).toLocaleString()} with ${
                        nextSession.healer_profiles?.profiles?.nickname ||
                        nextSession.healer_profiles?.profiles?.full_name
                      }`
                    : 'None scheduled'}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3 text-brand-green">Feedback from your most recent session</h2>
            {latestNote ? (
              <div className="brand-card space-y-2 text-sm">
                <p className="text-slate-500">
                  {new Date(latestNote.created_at).toLocaleDateString()} —{' '}
                  {latestNote.healer_profiles?.profiles?.nickname || latestNote.healer_profiles?.profiles?.full_name}
                </p>
                {latestNote.summary && <p className="text-brand-ink">{latestNote.summary}</p>}
              </div>
            ) : (
              <p className="brand-empty">
                No feedback yet — your healer will share notes here after your session.
              </p>
            )}
          </section>
        </>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3 text-brand-green">My Profile</h2>
        <p className="text-sm text-slate-500 bg-brand-mintSoft rounded-xl px-4 py-3 mb-4">
          Please fill out all fields below — they're required before you can save your profile or
          book a session.
        </p>
        <form onSubmit={handleSave} className="brand-card space-y-4 max-w-md">
          <div>
            <label className="brand-label">
              Your photo
            </label>
            {photoSignedUrl && (
              <img src={photoSignedUrl} alt="Your photo" className="w-20 h-20 rounded-full object-cover mb-2" />
            )}
            {photoFile && !photoSignedUrl && (
              <p className="text-xs text-amber-600 mb-2">New photo selected — it'll upload when you save.</p>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            {!photoSignedUrl && !photoFile && (
              <p className="text-xs text-red-500 mt-1">
                You must add a photo before you can save your profile or book a session.
              </p>
            )}
          </div>

          <div>
            <label className="brand-label">Email</label>
            <input value={email} disabled className="brand-input bg-slate-50 text-slate-500" />
            <p className="text-xs text-slate-400 mt-1">
              This is your login email and can't be changed here — contact us if you need it updated.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="brand-label">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="brand-input" />
            </div>
            <div>
              <label className="brand-label">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="brand-input" />
            </div>
          </div>

          <div>
            <label className="brand-label">Nickname</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="What should we call you?"
              className="brand-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="brand-label">Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="brand-input" />
            </div>
            <div>
              <label className="brand-label">Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="brand-select">
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="lgbtqia_plus">LGBTQIA+</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <label className="brand-label">
              Phone number
            </label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="brand-input"
            />
          </div>

          <div>
            <label className="brand-label">Reason for healing / main concern</label>
            <textarea
              value={reasonForHealing}
              onChange={(e) => setReasonForHealing(e.target.value)}
              rows={3}
              placeholder="What would you like to address through Pranic Healing?"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base resize-none"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="brand-label">Consent</p>
            <div className="text-xs text-slate-600 whitespace-pre-line border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto bg-slate-50">
              {CONSENT_TEXT}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5"
              />
              I have read and agree to the above.
            </label>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-brand-green">✓ Saved</span>}
          </div>
        </form>
      </section>

      <section>
        <div className="brand-card max-w-md">
          <p className="brand-section-title mb-1">Confidentiality Agreement (signed at sign-up)</p>
          {ndaAgreedAt ? (
            <p className="text-sm text-slate-600">
              ✅ Accepted on {new Date(ndaAgreedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Not yet on file.</p>
          )}
        </div>
      </section>
    </div>
  );
}
