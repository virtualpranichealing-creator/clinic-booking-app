import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

// Protects /admin, /healer, /patient routes: checks session + role,
// redirects unauthenticated users to /login and mismatched roles to their own area.
// /services just requires *any* logged-in session, regardless of role.
//
// The middleware runs on every page (see matcher below), not just the
// protected ones - createMiddlewareClient + getSession() is what silently
// refreshes the Supabase session cookie on each request. Restricting the
// matcher to only the protected routes meant public pages (Home, Contact,
// the public healers directory) never got that refresh, so a session
// nearing expiry could go stale while browsing there with nothing to
// refresh it - looking like an unexpected logout.
export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;

  const protectedRoutes = ['/admin', '/healer', '/patient', '/services'];
  const isProtected = protectedRoutes.some((r) => path.startsWith(r));

  if (!isProtected) return res;

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  if (path.startsWith('/services')) return res;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role;

  if (path.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL(`/${role}`, req.url));
  }
  if (path.startsWith('/healer') && role !== 'healer') {
    return NextResponse.redirect(new URL(`/${role}`, req.url));
  }
  // Healers and admin can browse/book with other healers too, same as
  // patients - no restriction on /patient beyond just being logged in.

  return res;
}

// Runs on every page except static assets/images, so the session-refresh
// side effect above happens everywhere - the isProtected check inside the
// function is what actually limits which routes get gated/redirected.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
