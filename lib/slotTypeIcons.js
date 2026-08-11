export const SLOT_TYPE_ICONS = {
  consultation: '🩺',
  healing: '🌿',
  physical_healing: '📍',
};

export const SLOT_TYPE_SHORT_LABELS = {
  consultation: 'Consultation',
  healing: 'Online Healing',
  physical_healing: 'Onsite (Ortigas)',
};

export function slotTypeIcon(slotTypeId) {
  return SLOT_TYPE_ICONS[slotTypeId] || '';
}
