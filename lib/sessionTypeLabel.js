// Combines slot_type_id + delivery_preference into one clear phrase, so every
// booking list in the app (admin, healer, patient) describes a session the
// same way instead of showing type and delivery mode as separate fragments.
export function sessionTypeLabel({ slotTypeId, deliveryPreference, paymentMethod }) {
  if (slotTypeId === 'consultation') return 'Consultation';

  if (slotTypeId === 'physical_healing' || paymentMethod === 'pay_at_office') {
    return 'Physical Pranic Healing (Onsite — Ortigas)';
  }

  if (slotTypeId === 'healing') {
    if (deliveryPreference === 'distant') return 'Distant Pranic Healing';
    if (deliveryPreference === 'online_realtime') return 'Online Real-Time Pranic Healing';
    return 'Online Pranic Healing';
  }

  return null;
}

export const SESSION_TYPE_ICONS = {
  Consultation: '🩺',
  'Distant Pranic Healing': '🌙',
  'Online Real-Time Pranic Healing': '🌿',
  'Online Pranic Healing': '🌿',
  'Physical Pranic Healing (Onsite — Ortigas)': '📍',
};
