// Single source of truth for the disclaimer / Data Privacy Act consent text
// shown wherever the app collects personal data (photos, contact info,
// health/session info) - was previously duplicated with slightly different
// wording across healer/profile, patient/profile, and patient/portal, which
// is exactly how compliance text drifts out of sync. Keep this verbatim as
// provided by the organization; don't edit the wording here casually.
//
// Split into pieces (rather than one fixed block) because the healer
// profile page shows both a patient-facing consent section AND the
// healer's own agreement on the same page - composing them separately
// lets that page show the Data Privacy paragraph once instead of twice,
// while patient/profile and patient/portal (which only show one consent
// block) still get the full text.
export const MEDICAL_DISCLAIMER_TEXT = `DISCLAIMER: Pranic Healing is a complementary non-touch energy healing system intended to enhance the body's natural self-healing capability. It is not intended to replace conventional medical treatment or diagnosis. If symptoms persist or are severe, please consult a licensed medical physician immediately. I hereby release the person(s) providing Pranic Healing and the Pranic Healing organization from any liability to the extent permitted by law as a result of the services received by me.`;

export const DATA_PRIVACY_TEXT = `DATA PRIVACY & CONFIDENTIALITY: In compliance with the Data Privacy Act, all personal information, medical history, and session records collected through this form will be kept strictly confidential. The information will be used for session tracking, healing protocol evaluation, internal record-keeping, and, where applicable, the assessment and certification of the healer. Access will be limited to authorized individuals responsible for the review, assessment, and certification process. For more information on how your personal information is collected, used, stored, and protected, please refer to the PHFP Privacy Notice available on our official website, www.pranichealing.com.ph`;

// Full patient consent block (medical disclaimer + data privacy) - used on
// pages where this is the ONLY consent text shown: patient/profile,
// patient/portal, and (via MEDICAL_DISCLAIMER_TEXT alone, see below) the
// "my details as a patient" section on the healer's own profile page.
export const PATIENT_DISCLAIMER_TEXT = `${MEDICAL_DISCLAIMER_TEXT}

${DATA_PRIVACY_TEXT}`;

// The healer's own onboarding agreement - keeps their existing role-specific
// commitments, with the same Data Privacy Act paragraph appended, since
// healers submit their own photo, personal details, and bank information
// through this form too.
export const HEALER_AGREEMENT_TEXT = `By submitting this form, you consent to the collection and secure storage of your information for the administration of the HOPE Project – Online Pranic Healing Sessions. Your personal information will be kept confidential and used only for official clinic purposes.

As a participating healer, I agree to:
• Follow the MCKS Pranic Healing teachings and Guidelines
• Keep all patient and information from this session strictly confidential.
• Maintain professionalism, integrity, and respect in all healing activities.
• Take responsibility for my own physical, emotional, and energetic well-being, and refrain from healing when unfit or seriously ill.
• Understand that participation may be subject to screening, including assessment of my physical, emotional, and energetic condition.
• Understand that my participation in the HOPE Project is voluntary and may be revoked at any time, without prior written notice, for justifiable cause, at the discretion of the project organizers.
• Understand that management may, at its discretion, opt not to include healers with an incomplete profile in the roster of healers.

${DATA_PRIVACY_TEXT}

By submitting this form, I confirm that I have read, understood, and agree to these terms.`;
