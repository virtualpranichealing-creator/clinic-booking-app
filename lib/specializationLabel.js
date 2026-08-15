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

// One category ("Pranic Healing for Pets") shares the same prefix, but
// unlike specializations the other categories don't - so there's no shared
// header to hoist it into, just shorten this one pill to "Pets" to match
// the others' brevity.
export function stripCategoryPrefix(name) {
  return name?.startsWith(PREFIX) ? name.slice(PREFIX.length) : name;
}
