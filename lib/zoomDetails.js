// Project HOPE's standing Zoom room, used for every online (real-time or
// consultation) session. If this ever changes, update it here once and
// every confirmation/reminder email (patient and healer) picks it up.
export const ZOOM_LINK = 'https://us06web.zoom.us/j/81883140283';
export const ZOOM_MEETING_ID = '818 8314 0283';
export const ZOOM_PASSCODE_NOTE = 'No Passcode needed';

// Physical/onsite sessions never need Zoom (already handled separately).
// Distant healing doesn't need it either - the healer performs it remotely
// while the patient rests, no live call required. Only real-time online
// sessions (and consultations, which are always live) need to actually join.
export function needsZoom(booking) {
  if (booking.payment_method === 'pay_at_office') return false;
  if (booking.delivery_preference === 'distant') return false;
  return true;
}

export function firstNameOf(profile) {
  return profile?.nickname || profile?.first_name || profile?.full_name?.split(' ')[0] || 'there';
}

