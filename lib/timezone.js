// A curated list covering the Philippines plus the timezones most common
// among OFWs/overseas Filipinos and international patients, rather than
// every IANA zone (which would be overwhelming in a plain <select>).
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Manila', label: 'Philippines — Manila (GMT+8)' },
  { value: 'Asia/Singapore', label: 'Singapore / Hong Kong (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Japan — Tokyo (GMT+9)' },
  { value: 'Asia/Seoul', label: 'South Korea — Seoul (GMT+9)' },
  { value: 'Asia/Dubai', label: 'UAE — Dubai (GMT+4)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia — Riyadh (GMT+3)' },
  { value: 'Asia/Qatar', label: 'Qatar — Doha (GMT+3)' },
  { value: 'Europe/London', label: 'UK — London (GMT+0/+1)' },
  { value: 'Europe/Berlin', label: 'Central Europe — Berlin/Paris (GMT+1/+2)' },
  { value: 'America/New_York', label: 'US — Eastern (GMT-5/-4)' },
  { value: 'America/Chicago', label: 'US — Central (GMT-6/-5)' },
  { value: 'America/Denver', label: 'US — Mountain (GMT-7/-6)' },
  { value: 'America/Los_Angeles', label: 'US — Pacific (GMT-8/-7)' },
  { value: 'Australia/Sydney', label: 'Australia — Sydney (GMT+10/+11)' },
  { value: 'Pacific/Auckland', label: 'New Zealand — Auckland (GMT+12/+13)' },
];

const STORAGE_KEY = 'preferredTimezone';

// Falls back to Manila if the browser's detected zone isn't in our curated
// list, rather than silently adding an unfamiliar zone to the dropdown.
export function detectDefaultTimezone() {
  if (typeof window === 'undefined') return 'Asia/Manila';
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_OPTIONS.some((tz) => tz.value === detected) ? detected : 'Asia/Manila';
  } catch {
    return 'Asia/Manila';
  }
}

export function loadStoredTimezone() {
  if (typeof window === 'undefined') return detectDefaultTimezone();
  return window.localStorage.getItem(STORAGE_KEY) || detectDefaultTimezone();
}

export function storeTimezone(tz) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, tz);
}

export function formatTime(date, timeZone) {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export function formatDateTime(date, timeZone) {
  return new Date(date).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });
}

export function timezoneAbbrev(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(
      new Date()
    );
    return parts.find((p) => p.type === 'timeZoneName')?.value || timeZone;
  } catch {
    return timeZone;
  }
}
