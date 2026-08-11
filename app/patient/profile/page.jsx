'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';

const CONSENT_TEXT = `I, the person filling out this form, understand that Pranic Healing is not meant to replace conventional medicine but rather to complement it. If symptoms persist, a medical professional is to be consulted immediately.

I am voluntarily participating in this Pranic Healing Treatment. I consent to the collection and use of my personal and health information for my Pranic Healing Treatment, Administrative needs and for Certification of the assigned Pranic Healer.

I hereby release the person(s) and/or the Pranic Healing organization from any liability as a result of the services received by me. The protected information provided will be dealt with sensitivity and in strict confidence, and may be disclosed or used for therapy and quality improvement.`;

export default function PatientProfilePage() {
  const [loading, setLoading] = useState(true);
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

  const [photoFile, setPhotoFile] = useState(null);
  const [photoSignedUrl, setPhotoSignedUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setEmail(data.email || user.email || '');
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setNickname(data.nickname || '');
      setMobile(data.mobile || '');
      setAge(data.age || '');
      setGender(data.gender || '');
      setReasonForHealing(data.reason_for_healing || '');
      setConsentChecked(!!data.consent_agreed);
      setAlreadyConsented(!!data.consent_agreed);
      setNdaAgreedAt(data.nda_agreed_at || null);

      if (data.avatar_url) {
        const { data: signed } = await supabase.storage
          .from('patient-photos')
          .createSignedUrl(data.avatar_url, 3600);
        if (signed) setPhotoSignedUrl(signed.signedUrl);
      }
    }
    setLoading(false);
  }

  async function uploadPhoto() {
    if (!photoFile) return;
    setUploadingPhoto(true);
    const { data: { user } } = await supabase.auth.getUser();

    const fileExt = photoFile.name.split('.').pop();
    const filePath = `${user.id}/photo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('patient-photos')
      .upload(filePath, photoFile, { upsert: true });

    if (!uploadError) {
      await supabase.from('profiles').update({ avatar_url: filePath }).eq('id', user.id);
      const { data: signed } = await supabase.storage
        .from('patient-photos')
        .createSignedUrl(filePath, 3600);
      if (signed) setPhotoSignedUrl(signed.signedUrl);
    }
    setPhotoFile(null);
    setUploadingPhoto(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!consentChecked) {
      setError('Please read and check the consent agreement to save your profile.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
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
        <p className="text-slate-400 text-sm">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="brand-page space-y-6">
      <AppNav />

      <div>
        <h1 className="text-2xl font-display font-bold text-brand-green">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Everything about you in one place — keep it up to date so your healer can prepare for
          your sessions.
        </p>
      </div>

      <form onSubmit={handleSave} className="brand-card space-y-4 max-w-md">
        <div>
          <label className="brand-label">Your photo (optional)</label>
          {photoSignedUrl && (
            <img src={photoSignedUrl} alt="Your photo" className="w-20 h-20 rounded-full object-cover mb-2" />
          )}
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            {photoFile && (
              <button
                type="button"
                onClick={uploadPhoto}
                disabled={uploadingPhoto}
                className="btn-secondary btn-sm"
              >
                {uploadingPhoto ? 'Uploading…' : 'Upload'}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="brand-label">Email</label>
          <input value={email} disabled className="brand-input bg-slate-50 text-slate-500" />
          <p className="text-[11px] text-slate-400 mt-1">
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
          <label className="brand-label">Phone number</label>
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
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none"
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
    </div>
  );
}
