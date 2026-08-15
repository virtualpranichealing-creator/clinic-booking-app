'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AppNav from '../../../components/AppNav';
import { stripSpecializationPrefix } from '../../../lib/specializationLabel';

const CREDENTIAL_OPTIONS = [
  'Basic Pranic Healing Instructor',
  'Advanced Pranic Healing Instructor',
  'Pranic Psychotherapy Instructor',
  'Pranic Crystal Graduate',
  'Pranic Psychotherapy Graduate',
  'Advanced Pranic Healing Graduate',
];

const AGREEMENT_TEXT = `By submitting this form, you consent to the collection and secure storage of your information for the administration of the HOPE Project – Online Pranic Healing Sessions. Your personal information will be kept confidential and used only for official clinic purposes.

As a participating healer, I agree to:
• Follow the MCKS Pranic Healing teachings and Guidelines
• Keep all patient and information from this session strictly confidential.
• Maintain professionalism, integrity, and respect in all healing activities.
• Take responsibility for my own physical, emotional, and energetic well-being, and refrain from healing when unfit or seriously ill.
• Understand that participation may be subject to screening, including assessment of my physical, emotional, and energetic condition.
• Understand that my participation in the HOPE Project is voluntary and may be revoked at any time, without prior written notice, for justifiable cause, at the discretion of the project organizers.

By submitting this form, I confirm that I have read, understood, and agree to these terms.`;

const PATIENT_CONSENT_TEXT = `I, the person filling out this form, understand that Pranic Healing is not meant to replace conventional medicine but rather to complement it. If symptoms persist, a medical professional is to be consulted immediately.

I am voluntarily participating in this Pranic Healing Treatment. I consent to the collection and use of my personal and health information for my Pranic Healing Treatment, Administrative needs and for Certification of the assigned Pranic Healer.

I hereby release the person(s) and/or the Pranic Healing organization from any liability as a result of the services received by me. The protected information provided will be dealt with sensitivity and in strict confidence, and may be disclosed or used for therapy and quality improvement.`;

export default function HealerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [title, setTitle] = useState('');
  const [selectedCredentials, setSelectedCredentials] = useState([]);
  const [location, setLocation] = useState('');
  const [allSpecializations, setAllSpecializations] = useState([]);
  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);

  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  // "My details as a patient" - only needed if this healer also wants to
  // book sessions with a fellow healer. Merged here instead of a separate
  // patient-portal form, since filling this out sets the same
  // consent_agreed flag the booking flow checks for.
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [reasonForHealing, setReasonForHealing] = useState('');
  const [patientConsentChecked, setPatientConsentChecked] = useState(false);
  const [alreadyPatientConsented, setAlreadyPatientConsented] = useState(false);

  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, nickname, age, gender, mobile, reason_for_healing, consent_agreed, email')
      .eq('id', user.id)
      .single();
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setNickname(profile.nickname || '');
      setAge(profile.age || '');
      setGender(profile.gender || '');
      setMobile(profile.mobile || '');
      setReasonForHealing(profile.reason_for_healing || '');
      setPatientConsentChecked(!!profile.consent_agreed);
      setAlreadyPatientConsented(!!profile.consent_agreed);
      setEmail(profile.email || user.email || '');
    }

    const { data: healerProfile } = await supabase
      .from('healer_profiles')
      .select('bio, photo_url, title, credentials, specializes_in, location')
      .eq('user_id', user.id)
      .single();
    if (healerProfile) {
      setBio(healerProfile.bio || '');
      setTitle(healerProfile.title || '');
      // Existing free-text credentials get parsed into the fixed list where
      // they match, so healers who already had this filled in don't lose it.
      setSelectedCredentials(
        (healerProfile.credentials || '')
          .split('\n')
          .map((c) => c.trim())
          .filter((c) => CREDENTIAL_OPTIONS.includes(c))
      );
      setLocation(healerProfile.location || '');
      setPhotoUrl(healerProfile.photo_url || null);
    }

    const { data: privateDetails } = await supabase
      .from('healer_private_details')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (privateDetails) {
      setBankName(privateDetails.bank_name || '');
      setBankAccountName(privateDetails.bank_account_name || '');
      setBankAccountNumber(privateDetails.bank_account_number || '');
      setAgreementAccepted(privateDetails.agreement_accepted || false);
    }

    const { data: categories } = await supabase.from('categories').select('*').order('name');
    setAllCategories(categories || []);

    const { data: myCategories } = await supabase
      .from('healer_categories')
      .select('category_id')
      .eq('healer_id', user.id);
    setSelectedCategoryIds((myCategories || []).map((c) => c.category_id));

    const { data: specializations } = await supabase
      .from('specializations')
      .select('*')
      .order('display_order');
    setAllSpecializations(specializations || []);

    const { data: mySpecializations } = await supabase
      .from('healer_specializations')
      .select('specialization_id')
      .eq('healer_id', user.id);
    setSelectedSpecializationIds((mySpecializations || []).map((s) => s.specialization_id));

    setLoading(false);
  }

  function toggleCategory(categoryId) {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  function toggleSpecialization(specializationId) {
    setSelectedSpecializationIds((prev) =>
      prev.includes(specializationId)
        ? prev.filter((id) => id !== specializationId)
        : [...prev, specializationId]
    );
  }

  function toggleCredential(credential) {
    setSelectedCredentials((prev) =>
      prev.includes(credential) ? prev.filter((c) => c !== credential) : [...prev, credential]
    );
  }

  async function handleSave() {
    if (!photoUrl && !photoFile) {
      window.alert('Please add a professional photo before saving your profile.');
      return;
    }
    if (!mobile.trim()) {
      window.alert('Please add your phone number before saving your profile.');
      return;
    }
    if (!agreementAccepted) {
      window.alert('Please read and accept the Confidentiality & Healer Agreement to continue.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    let currentPhotoUrl = photoUrl;
    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop();
      const filePath = `${user.id}/photo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('healer-photos')
        .upload(filePath, photoFile, { upsert: true });

      if (uploadError) {
        window.alert('Could not upload your photo. Please try again.');
        setSaving(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('healer-photos').getPublicUrl(filePath);
      currentPhotoUrl = publicUrlData.publicUrl;
      setPhotoUrl(currentPhotoUrl);
      setPhotoFile(null);
    }

    await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        nickname,
        age: age ? Number(age) : null,
        gender: gender || null,
        mobile,
        reason_for_healing: reasonForHealing,
        ...(patientConsentChecked
          ? {
              consent_agreed: true,
              consent_agreed_at: alreadyPatientConsented ? undefined : new Date().toISOString(),
            }
          : {}),
      })
      .eq('id', user.id);

    await supabase
      .from('healer_profiles')
      .update({
        bio,
        title,
        credentials: selectedCredentials.join('\n'),
        photo_url: currentPhotoUrl,
        location,
      })
      .eq('user_id', user.id);

    await supabase.from('healer_private_details').upsert({
      user_id: user.id,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      agreement_accepted: true,
      agreement_accepted_at: new Date().toISOString(),
    });

    // Replace this healer's category tags with the current selection
    await supabase.from('healer_categories').delete().eq('healer_id', user.id);
    if (selectedCategoryIds.length > 0) {
      await supabase.from('healer_categories').insert(
        selectedCategoryIds.map((categoryId) => ({ healer_id: user.id, category_id: categoryId }))
      );
    }

    // Replace this healer's specialization tags with the current selection
    await supabase.from('healer_specializations').delete().eq('healer_id', user.id);
    if (selectedSpecializationIds.length > 0) {
      await supabase.from('healer_specializations').insert(
        selectedSpecializationIds.map((specializationId) => ({
          healer_id: user.id,
          specialization_id: specializationId,
        }))
      );
    }

    setSaving(false);
    setSaved(true);
    if (patientConsentChecked) setAlreadyPatientConsented(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <AppNav />
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <AppNav />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">My Profile</h1>
        {userId && (
          <a
            href={`/patient/healer/${userId}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost btn-sm"
          >
            👁️ Preview my public profile
          </a>
        )}
      </div>

      <p className="text-sm text-slate-500 bg-brand-mintSoft rounded-xl px-4 py-3">
        Please fill out all fields below — they're required before you can save your profile or
        set your weekly availability. (The "My details as a patient" section further down is the
        one exception — that stays optional.)
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Personal details</h2>
        <div>
          <label className="block text-sm text-slate-500 mb-1">
            Professional photo
          </label>
          {photoUrl && (
            <img src={photoUrl} alt="Current photo" className="w-24 h-24 rounded-full object-cover mb-2" />
          )}
          {photoFile && !photoUrl && (
            <p className="text-xs text-amber-600 mb-2">New photo selected — it'll upload when you save.</p>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          {!photoUrl && !photoFile && (
            <p className="text-xs text-red-500 mt-1">
              You must add a photo before you can save your profile or set your availability.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Email</label>
          <input value={email} disabled className="w-full border border-slate-300 rounded px-3 py-2 bg-slate-50 text-slate-500" />
          <p className="text-xs text-slate-400 mt-1">
            This is your login email and can't be changed here — contact us if you need it updated.
          </p>
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">
            Phone number
          </label>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="09XX XXX XXXX"
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-500 mb-1">First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Nickname</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Professional details (patients will see this)</h2>
        <div>
          <label className="block text-sm text-slate-500 mb-1">
            Categories (tag what you specialize in — patients filter by these)
          </label>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`text-sm border rounded-full px-4 py-1.5 ${
                  selectedCategoryIds.includes(c.id)
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'border-slate-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
          <p className="text-xs text-slate-400 mt-1">
            Patients will see this on your public profile.
          </p>
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-xs text-slate-500">
            The fields below show up on your public profile page that patients see when browsing
            healers.
          </p>
          <div>
            <label className="block text-sm text-slate-500 mb-1">
              Title / certification badge
            </label>
            <select
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
            >
              <option value="">Select…</option>
              <option value="Associate Certified Pranic Healer">Associate Certified Pranic Healer</option>
              <option value="Certified Pranic Healer">Certified Pranic Healer</option>
              <option value="Ongoing Certification">Ongoing Certification</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">
              Credentials (tap to select — you can choose more than one)
            </label>
            <div className="flex flex-wrap gap-2">
              {CREDENTIAL_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCredential(c)}
                  className={`text-sm border rounded-full px-4 py-1.5 text-left ${
                    selectedCredentials.includes(c)
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'border-slate-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">
              Specializes in (tap to select — patients will see these listed on your profile)
            </label>
            <p className="text-xs text-slate-400 italic mb-1.5">Pranic Healing for:</p>
            <div className="flex flex-wrap gap-2">
              {allSpecializations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSpecialization(s.id)}
                  className={`text-xs border rounded-full px-3 py-1.5 text-left ${
                    selectedSpecializationIds.includes(s.id)
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'border-slate-300'
                  }`}
                >
                  {stripSpecializationPrefix(s.label)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Quezon City"
              className="w-full border border-slate-300 rounded px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Bank details</h2>
        <p className="text-xs text-slate-500">
          Kept private — only visible to you and the admin team, never shown to patients.
        </p>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Bank name</label>
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Account name</label>
          <input
            value={bankAccountName}
            onChange={(e) => setBankAccountName(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">Account number</label>
          <input
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-medium">My details as a patient</h2>
        <p className="text-xs text-slate-500">
          Optional — only needed if you'd also like to book Pranic Healing sessions with a fellow
          healer yourself. Filling this in and agreeing below unlocks booking, so you don't need a
          separate patient account. Healers need healing support too sometimes — don't hesitate to
          book a session for yourself whenever you need one.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2"
            >
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="lgbtqia_plus">LGBTQIA+</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">
            Reason for healing / main concern (as a patient)
          </label>
          <textarea
            value={reasonForHealing}
            onChange={(e) => setReasonForHealing(e.target.value)}
            rows={3}
            placeholder="What would you like to address through Pranic Healing?"
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div className="text-xs text-slate-600 whitespace-pre-line border rounded p-3 max-h-40 overflow-y-auto bg-slate-50">
          {PATIENT_CONSENT_TEXT}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={patientConsentChecked}
            onChange={(e) => setPatientConsentChecked(e.target.checked)}
            className="mt-0.5"
          />
          I have read and agree to the above, as a patient.
        </label>
      </section>

      <section className="space-y-3 border-t pt-4">
        <h2 className="text-lg font-medium">Confidentiality & Healer Agreement</h2>
        <div className="text-xs text-slate-600 whitespace-pre-line border rounded p-3 max-h-48 overflow-y-auto bg-slate-50">
          {AGREEMENT_TEXT}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreementAccepted}
            onChange={(e) => setAgreementAccepted(e.target.checked)}
          />
          I have read, understood, and agree to these terms.
        </label>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-slate-800 text-white rounded px-4 py-2 text-sm"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
      {saved && <span className="ml-3 text-green-700 text-sm">Saved!</span>}
    </div>
  );
}
