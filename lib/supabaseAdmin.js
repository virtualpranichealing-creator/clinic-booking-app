import { createClient } from '@supabase/supabase-js';

// This client uses the SERVICE ROLE key — it can bypass all security rules.
// It must ONLY ever be used inside API routes (server-side), never sent to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
