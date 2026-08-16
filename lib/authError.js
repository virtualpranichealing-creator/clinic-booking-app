// Supabase auth calls occasionally come back with an error that has no
// usable .message (an empty body from a downstream email service, a rate
// limit response with no description, etc.) - shown raw, an empty object's
// default toString reads as the literal text "{}", which is exactly what
// showed up on the Forgot Password page. Falls back to a clear message
// whenever the real one is missing or unhelpful.
export function readableAuthError(error, fallback = 'Something went wrong. Please try again in a moment.') {
  const message = error?.message?.trim();
  if (!message || message === '{}' || message === '[object Object]') return fallback;
  return message;
}
