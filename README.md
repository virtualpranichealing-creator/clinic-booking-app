# Clinic Booking App — Starter

A starter Next.js + Supabase project with three roles: **admin**, **healer**, **patient**.

## What's included

- `schema.sql` — full Postgres schema + Row-Level Security policies (run this in Supabase)
- `app/login` — email/password login
- `app/admin` — manage healers, view all bookings
- `app/healer` — add availability slots, view/manage own bookings
- `app/patient` — browse healers, book open slots, view own bookings
- `middleware.js` — redirects users to the right dashboard based on their role, blocks cross-role access

## Setup

### 1. Create a Supabase project
Go to https://supabase.com, create a new project, and grab your **Project URL** and **anon public key** from Settings → API.

### 2. Run the schema
Open the SQL Editor in your Supabase dashboard, paste the contents of `schema.sql`, and run it. This creates all tables, RLS policies, and a trigger that auto-creates a `profiles` row (defaulting to `patient`) whenever someone signs up.

### 3. Configure environment variables
Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key:

```
cp .env.example .env.local
```

### 4. Install dependencies and run

```
npm install
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/login`.

### 5. Create your first users
Sign up via Supabase Auth (you can do this through the app's login form if you add a signup flow, or directly in the Supabase dashboard under Authentication → Users). New users default to the `patient` role.

To make someone an **admin** or **healer**, update their row manually in the `profiles` table:

```sql
update public.profiles set role = 'healer' where id = 'the-users-uuid';

-- and if they're a healer, also add their healer profile:
insert into public.healer_profiles (user_id, specialty, bio)
values ('the-users-uuid', 'Physiotherapy', 'Bio goes here');
```

## Next steps to build out

- **Signup page** (`app/signup`) — currently only login is scaffolded
- **Recurring availability** — the `availability_rules` table is defined in the schema but not yet wired to auto-generate `slots`; right now healers add slots one at a time from their dashboard
- **Email/SMS reminders** — hook up Resend or Twilio when a booking is created/cancelled
- **Payments** — add Stripe if you want to charge for bookings
- **Calendar view** — swap the simple slot-list UI for a FullCalendar view (the package is already in `package.json`)

## Folder structure

```
clinic-booking-app/
├── schema.sql
├── middleware.js
├── lib/
│   └── supabaseClient.js
├── app/
│   ├── layout.jsx
│   ├── page.jsx          (redirects to /login)
│   ├── login/page.jsx
│   ├── admin/page.jsx
│   ├── healer/page.jsx
│   └── patient/page.jsx
```
