// Every specialization label currently starts with "Pranic Healing for "
// (e.g. "Pranic Healing for Skin Disorders"), which is redundant once it's
// shown as a header above a list of them. This strips that shared prefix so
// lists can show just "Skin Disorders" etc. under a "Pranic Healing for"
// heading - falls back to the full label untouched if a future entry
// doesn't use the prefix.
const PREFIX = 'Pranic Healing for ';

export function stripSpecializationPrefix(label) {
  return label?.startsWith(PREFIX) ? label.slice(PREFIX.length) : label;
}
