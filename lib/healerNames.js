// profiles' RLS only allows `id = auth.uid()`, so a patient-session query that
// tries to join straight to a healer's profiles row (for their name) gets
// silently dropped by Postgres RLS. healer_public_profiles is a narrow view
// (just id/nickname/full_name, only for active+approved healers) that's
// safe to grant broader read access to - this fetches names through it and
// returns a lookup map instead.
export async function fetchHealerNames(supabase, healerIds) {
  const ids = [...new Set(healerIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data } = await supabase.from('healer_public_profiles').select('id, nickname, full_name').in('id', ids);

  return Object.fromEntries((data || []).map((n) => [n.id, n]));
}

export function healerDisplayName(namesById, healerId, fallback = 'Healer') {
  const n = namesById[healerId];
  return n?.nickname || n?.full_name || fallback;
}
