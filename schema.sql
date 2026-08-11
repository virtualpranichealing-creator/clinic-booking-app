-- ============================================================
-- Pranic Healing Foundation — Booking System
-- Full Schema: roles, categories, slot types, packages,
-- payment verification, session observations
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ---------------------------------------------------------
-- 1. Profiles (extends Supabase auth.users)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'healer', 'patient')),
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------
-- 2. Categories (Health, Relationships, Pets, etc.)
-- ---------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

-- ---------------------------------------------------------
-- 3. Healer profiles + their categories
-- ---------------------------------------------------------
create table if not exists public.healer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  specialty_summary text,
  bio text,
  is_active boolean not null default true
);

create table if not exists public.healer_categories (
  healer_id uuid references public.healer_profiles(user_id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  primary key (healer_id, category_id)
);

-- ---------------------------------------------------------
-- 4. Slot types: fixed durations for the two session kinds
-- ---------------------------------------------------------
create table if not exists public.slot_types (
  id text primary key, -- 'consultation' or 'healing'
  label text not null,
  duration_minutes int not null
);

insert into public.slot_types (id, label, duration_minutes) values
  ('consultation', 'Consultation (Energetic Assessment)', 30),
  ('healing', 'Online Pranic Healing Session', 60)
on conflict (id) do nothing;

-- Relabel for healers/patients who already have this row from before onsite
-- sessions existed, since "on conflict do nothing" won't touch it.
update public.slot_types set label = 'Online Pranic Healing Session' where id = 'healing';

-- ---------------------------------------------------------
-- 5. Healer weekly availability rules (used to generate slots)
-- ---------------------------------------------------------
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  healer_id uuid not null references public.healer_profiles(user_id) on delete cascade,
  slot_type_id text not null references public.slot_types(id),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null
);

-- ---------------------------------------------------------
-- 6. Slots — each one is a unique, individually bookable unit
-- ---------------------------------------------------------
create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  healer_id uuid not null references public.healer_profiles(user_id) on delete cascade,
  slot_type_id text not null references public.slot_types(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean not null default false, -- true while reserved OR booked
  created_at timestamptz default now(),
  unique (healer_id, start_time)
);

-- ---------------------------------------------------------
-- 7. Service packages (bundles of sessions)
-- ---------------------------------------------------------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  slot_type_id text not null references public.slot_types(id),
  session_count int not null,
  price numeric(10,2) not null,
  is_active boolean not null default true
);

-- A patient's purchased package + how many sessions they have left
create table if not exists public.patient_packages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.packages(id),
  sessions_remaining int not null,
  payment_status text not null default 'reserved' check (payment_status in ('reserved', 'booked', 'cancelled')),
  payment_method text check (payment_method in ('qr_maribank', 'paypal')),
  payment_proof_url text,
  purchased_at timestamptz default now()
);

-- ---------------------------------------------------------
-- 8. Bookings
-- ---------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  healer_id uuid not null references public.healer_profiles(user_id) on delete cascade,

  -- 'reserved' = payment pending verification, slot is held
  -- 'booked'   = payment verified, slot permanently taken, emails/zoom sent
  -- 'cancelled'= payment never verified (admin released), slot freed
  -- 'completed'/'no_show' = after the session happened
  status text not null default 'reserved'
    check (status in ('reserved', 'booked', 'cancelled', 'completed', 'no_show')),

  payment_method text check (payment_method in ('qr_maribank', 'paypal', 'package')),
  payment_proof_url text, -- uploaded screenshot/receipt
  patient_package_id uuid references public.patient_packages(id), -- if paid via package credit

  zoom_link text,
  reminder_sent boolean not null default false,

  created_at timestamptz default now(),
  booked_at timestamptz -- set when admin verifies payment
);

-- ---------------------------------------------------------
-- 9. Session observations (per booking) — chakra/organ notes
-- ---------------------------------------------------------
create table if not exists public.session_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  healer_id uuid not null references public.healer_profiles(user_id),
  patient_id uuid not null references public.profiles(id),
  summary text,
  created_at timestamptz default now()
);

create table if not exists public.observation_items (
  id uuid primary key default gen_random_uuid(),
  session_note_id uuid not null references public.session_notes(id) on delete cascade,
  body_part text not null, -- e.g. 'Solar Plexus Chakra', 'Liver'
  status text not null check (status in ('overactive', 'underactive', 'balanced', 'depleted')),
  notes text,
  drawing_data text -- base64 or JSON path data from a drawing tool
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.healer_profiles enable row level security;
alter table public.healer_categories enable row level security;
alter table public.slot_types enable row level security;
alter table public.availability_rules enable row level security;
alter table public.slots enable row level security;
alter table public.packages enable row level security;
alter table public.patient_packages enable row level security;
alter table public.bookings enable row level security;
alter table public.session_notes enable row level security;
alter table public.observation_items enable row level security;

create or replace function public.current_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---- profiles ----
drop policy if exists "View own profile or admin views all" on public.profiles;
create policy "View own profile or admin views all" on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'admin');
drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update using (id = auth.uid());
drop policy if exists "Insert own profile or admin" on public.profiles;
create policy "Insert own profile or admin" on public.profiles
  for insert with check (public.current_role() = 'admin' or id = auth.uid());

-- ---- categories / slot_types (public read, admin write) ----
drop policy if exists "Anyone authenticated can view categories" on public.categories;
create policy "Anyone authenticated can view categories" on public.categories
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories
  for insert with check (public.current_role() = 'admin');
drop policy if exists "Admins update categories" on public.categories;
create policy "Admins update categories" on public.categories
  for update using (public.current_role() = 'admin');
drop policy if exists "Admins delete categories" on public.categories;
create policy "Admins delete categories" on public.categories
  for delete using (public.current_role() = 'admin');

drop policy if exists "Anyone authenticated can view slot types" on public.slot_types;
create policy "Anyone authenticated can view slot types" on public.slot_types
  for select using (auth.role() = 'authenticated');

-- ---- healer_profiles ----
drop policy if exists "Anyone authenticated can view healer profiles" on public.healer_profiles;
create policy "Anyone authenticated can view healer profiles" on public.healer_profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists "Healers manage own profile, admins manage all" on public.healer_profiles;
create policy "Healers manage own profile, admins manage all" on public.healer_profiles
  for all using (user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "Anyone authenticated can view healer categories" on public.healer_categories;
create policy "Anyone authenticated can view healer categories" on public.healer_categories
  for select using (auth.role() = 'authenticated');
drop policy if exists "Healers/admins manage healer categories" on public.healer_categories;
create policy "Healers/admins manage healer categories" on public.healer_categories
  for all using (healer_id = auth.uid() or public.current_role() = 'admin');

-- ---- availability_rules ----
drop policy if exists "Anyone authenticated can view availability" on public.availability_rules;
create policy "Anyone authenticated can view availability" on public.availability_rules
  for select using (auth.role() = 'authenticated');
drop policy if exists "Healers manage own availability, admins manage all" on public.availability_rules;
create policy "Healers manage own availability, admins manage all" on public.availability_rules
  for all using (healer_id = auth.uid() or public.current_role() = 'admin');

-- ---- slots ----
drop policy if exists "Anyone authenticated can view slots" on public.slots;
create policy "Anyone authenticated can view slots" on public.slots
  for select using (auth.role() = 'authenticated');
drop policy if exists "Healers manage own slots, admins manage all" on public.slots;
create policy "Healers manage own slots, admins manage all" on public.slots
  for all using (healer_id = auth.uid() or public.current_role() = 'admin');

-- ---- packages (public read, admin manage) ----
drop policy if exists "Anyone authenticated can view packages" on public.packages;
create policy "Anyone authenticated can view packages" on public.packages
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins manage packages" on public.packages;
create policy "Admins manage packages" on public.packages
  for all using (public.current_role() = 'admin');

-- ---- patient_packages ----
drop policy if exists "Patients view own packages, admins view all" on public.patient_packages;
create policy "Patients view own packages, admins view all" on public.patient_packages
  for select using (patient_id = auth.uid() or public.current_role() = 'admin');
drop policy if exists "Patients purchase own packages" on public.patient_packages;
create policy "Patients purchase own packages" on public.patient_packages
  for insert with check (patient_id = auth.uid());
drop policy if exists "Admins verify/update packages" on public.patient_packages;
create policy "Admins verify/update packages" on public.patient_packages
  for update using (public.current_role() = 'admin' or patient_id = auth.uid());

-- ---- bookings ----
drop policy if exists "Relevant parties view bookings" on public.bookings;
create policy "Relevant parties view bookings" on public.bookings
  for select using (
    patient_id = auth.uid() or healer_id = auth.uid() or public.current_role() = 'admin'
  );
drop policy if exists "Patients create own bookings" on public.bookings;
create policy "Patients create own bookings" on public.bookings
  for insert with check (patient_id = auth.uid());
drop policy if exists "Relevant parties update bookings" on public.bookings;
create policy "Relevant parties update bookings" on public.bookings
  for update using (
    patient_id = auth.uid() or healer_id = auth.uid() or public.current_role() = 'admin'
  );

-- ---- session_notes / observation_items ----
drop policy if exists "Healer/patient/admin view session notes" on public.session_notes;
create policy "Healer/patient/admin view session notes" on public.session_notes
  for select using (
    healer_id = auth.uid() or patient_id = auth.uid() or public.current_role() = 'admin'
  );
drop policy if exists "Healers create session notes" on public.session_notes;
create policy "Healers create session notes" on public.session_notes
  for insert with check (healer_id = auth.uid());
drop policy if exists "Healers update own session notes" on public.session_notes;
create policy "Healers update own session notes" on public.session_notes
  for update using (healer_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "View observation items via session note access" on public.observation_items;
create policy "View observation items via session note access" on public.observation_items
  for select using (
    exists (
      select 1 from public.session_notes sn
      where sn.id = session_note_id
      and (sn.healer_id = auth.uid() or sn.patient_id = auth.uid() or public.current_role() = 'admin')
    )
  );
drop policy if exists "Healers manage observation items" on public.observation_items;
create policy "Healers manage observation items" on public.observation_items
  for all using (
    exists (
      select 1 from public.session_notes sn
      where sn.id = session_note_id and sn.healer_id = auth.uid()
    ) or public.current_role() = 'admin'
  );

-- ============================================================
-- Auto-create profile on signup (defaults to 'patient')
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'patient')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Starter categories (edit/add your own later from the admin portal)
-- ============================================================
insert into public.categories (name) values
  ('Health'), ('Relationships'), ('Pranic Healing for Pets'), ('General Wellness')
on conflict (name) do nothing;

-- ============================================================
-- Storage policies for the 'payment-proofs' bucket
-- (Create the bucket in the Supabase dashboard first, then run this)
-- ============================================================
drop policy if exists "Patients upload own payment proofs" on storage.objects;
create policy "Patients upload own payment proofs"
on storage.objects for insert
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Patients view own payment proofs, admins view all" on storage.objects;
create policy "Patients view own payment proofs, admins view all"
on storage.objects for select
using (
  bucket_id = 'payment-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_role() = 'admin'
  )
);

-- ============================================================
-- Auto-generate bookable slots from a healer's weekly availability rules
-- Slices each rule's time range into individual slot_type-duration slots
-- Skips any that already exist (safe to re-run any time)
-- ============================================================
create or replace function public.generate_slots_for_healer(
  p_healer_id uuid,
  p_weeks_ahead int default 4
)
returns void
language plpgsql
security definer
as $$
declare
  rule record;
  duration int;
  i int;
  day_date date;
  slot_start timestamptz;
  slot_end timestamptz;
begin
  -- Only the healer themselves or an admin may generate slots
  if auth.uid() != p_healer_id and public.current_role() != 'admin' then
    raise exception 'Not authorized to generate slots for this healer';
  end if;

  for rule in
    select ar.*, st.duration_minutes
    from public.availability_rules ar
    join public.slot_types st on st.id = ar.slot_type_id
    where ar.healer_id = p_healer_id
  loop
    duration := rule.duration_minutes;

    for i in 0..(p_weeks_ahead * 7 - 1) loop
      day_date := (now() at time zone 'Asia/Manila')::date + i;

      if extract(dow from day_date) = rule.day_of_week then
        -- Healers set their availability in local Philippine time (Asia/Manila,
        -- UTC+8, no DST). Converting explicitly here — instead of letting the
        -- database's default (UTC) session timezone silently treat "2:00 PM"
        -- as 2:00 PM UTC — is what keeps a healer's "2 PM" showing up as 2 PM
        -- for patients instead of drifting 8 hours to 10 PM.
        slot_start := (day_date + rule.start_time) at time zone 'Asia/Manila';

        while slot_start + (duration || ' minutes')::interval <= (day_date + rule.end_time) at time zone 'Asia/Manila' loop
          slot_end := slot_start + (duration || ' minutes')::interval;

          insert into public.slots (healer_id, slot_type_id, start_time, end_time)
          values (p_healer_id, rule.slot_type_id, slot_start, slot_end)
          on conflict (healer_id, start_time) do nothing;

          slot_start := slot_end;
        end loop;
      end if;
    end loop;
  end loop;
end;
$$;

grant execute on function public.generate_slots_for_healer(uuid, int) to authenticated;

-- ============================================================
-- Store email on profiles (needed server-side to send notifications)
-- ============================================================
alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    new.email
  );
  return new;
end;
$$;

-- Backfill email for any profiles created before this change
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- ============================================================
-- Track each slot's own status directly (available / reserved / booked)
-- so patients can see accurate colors without needing access to other
-- patients' private booking records
-- ============================================================
alter table public.slots add column if not exists current_status text not null default 'available'
  check (current_status in ('available', 'reserved', 'booked'));

-- Replace the earlier "hold the slot on booking" trigger to also set current_status
create or replace function public.handle_booking_created()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.slots
  set is_booked = true, current_status = 'reserved'
  where id = new.slot_id;
  return new;
end;
$$;

-- Replace the earlier cancellation trigger to also handle "booked" and reset current_status
create or replace function public.handle_booking_status_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'booked' and old.status != 'booked' then
    update public.slots set current_status = 'booked' where id = new.slot_id;
  elsif new.status = 'cancelled' and old.status != 'cancelled' then
    update public.slots set is_booked = false, current_status = 'available' where id = new.slot_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_booking_cancelled on public.bookings;
drop trigger if exists on_booking_status_change on public.bookings;
create trigger on_booking_status_change
  after update on public.bookings
  for each row execute procedure public.handle_booking_status_change();

-- Backfill current_status for any slots already booked before this change
update public.slots s
set current_status = b.status
from public.bookings b
where b.slot_id = s.id and b.status in ('booked')
and s.current_status = 'available';

update public.slots s
set current_status = 'reserved'
from public.bookings b
where b.slot_id = s.id and b.status = 'reserved'
and s.current_status = 'available';

-- ============================================================
-- Extended profile fields (name parts, patient intake, status)
-- ============================================================
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists nickname text;

-- Patient-specific intake fields
alter table public.profiles add column if not exists age int;
alter table public.profiles add column if not exists gender text
  check (gender in ('female', 'male', 'lgbtqia_plus', 'prefer_not_to_say'));
alter table public.profiles add column if not exists mobile text;
alter table public.profiles add column if not exists reason_for_healing text;
alter table public.profiles add column if not exists delivery_preference text
  check (delivery_preference in ('online_realtime', 'distant'));
alter table public.profiles add column if not exists consent_agreed boolean not null default false;
alter table public.profiles add column if not exists consent_agreed_at timestamptz;
alter table public.profiles add column if not exists patient_status text not null default 'active'
  check (patient_status in ('active', 'inactive'));

-- Healer-specific public fields (photo is fine to be visible to patients)
alter table public.healer_profiles add column if not exists photo_url text;
alter table public.healer_profiles add column if not exists onsite_available boolean not null default false;

-- ============================================================
-- Healer private details — bank info & signed agreement.
-- Kept in a SEPARATE table with its own strict RLS so patients
-- (who can see healer_profiles for browsing) never see this.
-- ============================================================
create table if not exists public.healer_private_details (
  user_id uuid primary key references public.healer_profiles(user_id) on delete cascade,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  agreement_accepted boolean not null default false,
  agreement_accepted_at timestamptz
);

alter table public.healer_private_details enable row level security;

drop policy if exists "Healer sees own private details, admin sees all" on public.healer_private_details;
create policy "Healer sees own private details, admin sees all" on public.healer_private_details
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
drop policy if exists "Healer manages own private details, admin manages all" on public.healer_private_details;
create policy "Healer manages own private details, admin manages all" on public.healer_private_details
  for all using (user_id = auth.uid() or public.current_role() = 'admin');

-- ============================================================
-- Chakra reference list (the 11 points healers assess each session)
-- ============================================================
create table if not exists public.chakras (
  id text primary key,
  label text not null,
  display_order int not null
);

insert into public.chakras (id, label, display_order) values
  ('crown', 'Crown', 1),
  ('forehead', 'Forehead', 2),
  ('ajna', 'Ajna', 3),
  ('throat', 'Throat', 4),
  ('heart_front', 'Heart (Front)', 5),
  ('heart_back', 'Heart (Back)', 6),
  ('solar_plexus_front', 'Solar Plexus (Front)', 7),
  ('solar_plexus_back', 'Solar Plexus (Back)', 8),
  ('spleen', 'Spleen', 9),
  ('sex', 'Sex', 10),
  ('basic', 'Basic', 11)
on conflict (id) do nothing;

alter table public.chakras enable row level security;
drop policy if exists "Anyone authenticated can view chakras" on public.chakras;
create policy "Anyone authenticated can view chakras" on public.chakras
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Session notes: add a whole-body canvas drawing, and switch
-- observation_items to reference the chakra list directly.
-- Also update the status options to match: Overactivated /
-- Underactivated / Congested / Depleted
-- ============================================================
alter table public.session_notes add column if not exists drawing_data text;

alter table public.observation_items add column if not exists chakra_id text references public.chakras(id);

alter table public.observation_items drop constraint if exists observation_items_status_check;
alter table public.observation_items add constraint observation_items_status_check
  check (status in ('overactivated', 'underactivated', 'congested', 'depleted'));

-- ============================================================
-- Storage policies for the 'healer-photos' bucket (public read,
-- healer/admin write). Create this bucket in the dashboard as PUBLIC.
-- ============================================================
drop policy if exists "Anyone can view healer photos" on storage.objects;
create policy "Anyone can view healer photos"
on storage.objects for select
using (bucket_id = 'healer-photos');

drop policy if exists "Healers upload own photo, admins upload any" on storage.objects;
create policy "Healers upload own photo, admins upload any"
on storage.objects for insert
with check (
  bucket_id = 'healer-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_role() = 'admin'
  )
);

drop policy if exists "Healers update own photo, admins update any" on storage.objects;
create policy "Healers update own photo, admins update any"
on storage.objects for update
using (
  bucket_id = 'healer-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_role() = 'admin'
  )
);

-- ============================================================
-- Storage policies for the 'patient-photos' bucket (kept private —
-- visible only to the patient themselves, their healers, and admin)
-- Create this bucket in the dashboard as PRIVATE.
-- ============================================================
drop policy if exists "Patients upload own photo" on storage.objects;
create policy "Patients upload own photo"
on storage.objects for insert
with check (
  bucket_id = 'patient-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Patient, any healer, or admin can view patient photos" on storage.objects;
create policy "Patient, any healer, or admin can view patient photos"
on storage.objects for select
using (
  bucket_id = 'patient-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_role() in ('healer', 'admin')
  )
);

drop policy if exists "Patients update own photo" on storage.objects;
create policy "Patients update own photo"
on storage.objects for update
using (
  bucket_id = 'patient-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- Healer approval workflow — new healers start "pending" and are
-- invisible to patients until an admin approves them
-- ============================================================
alter table public.healer_profiles add column if not exists approval_status text not null default 'pending'
  check (approval_status in ('pending', 'approved', 'rejected'));

-- ============================================================
-- Delivery preference now lives per-booking (chosen each time a
-- patient books a session), not as a one-time profile setting
-- ============================================================
alter table public.bookings add column if not exists delivery_preference text
  check (delivery_preference in ('online_realtime', 'distant'));

-- ============================================================
-- Replace placeholder categories with the real ones
-- ============================================================
delete from public.categories where name in ('Health', 'Relationships', 'General Wellness');

insert into public.categories (name) values
  ('Physical Health & Recovery'),
  ('Emotional & Mental Wellness'),
  ('Life, Career & Relationships'),
  ('Healthy Aging & Preventive Care'),
  ('Enhancing Defense and Immunity'),
  ('Pranic Healing for Pets')
on conflict (name) do nothing;

-- ============================================================
-- Richer healer profile content for the public-facing profile page
-- ============================================================
alter table public.healer_profiles add column if not exists title text; -- e.g. "Certified Associate Pranic Healer"
alter table public.healer_profiles add column if not exists credentials text; -- multiline, e.g. instructor titles
alter table public.healer_profiles add column if not exists specializes_in text; -- multiline, one item per line
alter table public.healer_profiles add column if not exists additional_notes text; -- free text block
alter table public.healer_profiles add column if not exists location text; -- e.g. "Quezon City"

-- ============================================================
-- Specializations — a second, more specific tag list healers pick
-- from (separate from the 6 broad categories). Phrased as
-- "Pranic Healing for X" rather than medical "treatment" language.
-- ============================================================
create table if not exists public.specializations (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  display_order int not null
);

insert into public.specializations (label, display_order) values
  ('Pranic Healing for Eyes, Ears and Throat', 1),
  ('Pranic Healing for Skin Disorders', 2),
  ('Pranic Healing for Heart and Circulatory System', 3),
  ('Pranic Healing for Respiratory System', 4),
  ('Pranic Healing for Gastrointestinal System', 5),
  ('Pranic Healing for Urinary System', 6),
  ('Pranic Healing for Reproductive System', 7),
  ('Pranic Healing for Endocrine System', 8),
  ('Pranic Healing for Skeletal and Muscular System', 9),
  ('Pranic Healing for Blood Disorders', 10),
  ('Pranic Healing for Brain and Nervous System Disorders', 11),
  ('Pranic Healing for Tumors and Cancer', 12),
  ('Pranic Healing for Psychological Wellbeing', 13),
  ('Pranic Healing for Financial Wellness', 14),
  ('Pranic Healing for Relationships (Family and Couples)', 15),
  ('Pranic Healing for Business', 16)
on conflict (label) do nothing;

alter table public.specializations enable row level security;
drop policy if exists "Anyone authenticated can view specializations" on public.specializations;
create policy "Anyone authenticated can view specializations" on public.specializations
  for select using (auth.role() = 'authenticated');

create table if not exists public.healer_specializations (
  healer_id uuid references public.healer_profiles(user_id) on delete cascade,
  specialization_id uuid references public.specializations(id) on delete cascade,
  primary key (healer_id, specialization_id)
);

alter table public.healer_specializations enable row level security;
drop policy if exists "Anyone authenticated can view healer specializations" on public.healer_specializations;
create policy "Anyone authenticated can view healer specializations" on public.healer_specializations
  for select using (auth.role() = 'authenticated');
drop policy if exists "Healers/admins manage healer specializations" on public.healer_specializations;
create policy "Healers/admins manage healer specializations" on public.healer_specializations
  for all using (healer_id = auth.uid() or public.current_role() = 'admin');

-- ============================================================
-- Physical (onsite) healing sessions at the PHFP Ortigas Center.
-- Fixed window for everyone: Tuesday-Friday, 2:00-5:00 PM.
-- Reuses the existing availability_rules -> slots pipeline so
-- these behave exactly like other bookable sessions (calendar,
-- reserve/verify flow, admin dashboard) with one difference:
-- payment happens in person, not via QR/PayPal upload.
-- ============================================================
insert into public.slot_types (id, label, duration_minutes) values
  ('physical_healing', 'Physical Healing Session — Onsite (PHFP Ortigas Center)', 60)
on conflict (id) do nothing;

-- Enforce the fixed onsite window at the database level, independent of
-- the UI: Tuesday(2)-Friday(5), 2:00 PM-5:00 PM only. Healers pick which
-- 1-hour block(s) within that window they're free for (2-3, 3-4, 4-5).
alter table public.availability_rules drop constraint if exists physical_healing_window_check;
alter table public.availability_rules add constraint physical_healing_window_check
  check (
    slot_type_id <> 'physical_healing'
    or (day_of_week between 2 and 5 and start_time >= time '14:00' and end_time <= time '17:00')
  );

alter table public.slots drop constraint if exists physical_healing_slot_window_check;

-- The corrected constraint below checks local Philippine time, so any slots
-- still holding pre-fix (UTC-as-local) timestamps must be corrected first,
-- or adding the constraint would immediately reject that old data. Guarded
-- by a migrations table so it only ever runs once.
create table if not exists public._schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from public._schema_migrations where id = 'fix_slot_timezone_2026_08') then
    -- Dropped and re-added around the update: Postgres checks a plain
    -- unique constraint per-row as the update runs, not just at the end,
    -- so shifting many rows at once can trip over itself when one row's
    -- new time briefly matches another row's not-yet-shifted old time -
    -- even though the final result has no real duplicates.
    alter table public.slots drop constraint if exists slots_healer_id_start_time_key;

    update public.slots
    set start_time = start_time - interval '8 hours',
        end_time = end_time - interval '8 hours';

    alter table public.slots add constraint slots_healer_id_start_time_key unique (healer_id, start_time);

    insert into public._schema_migrations (id) values ('fix_slot_timezone_2026_08');
  end if;
end $$;

alter table public.slots add constraint physical_healing_slot_window_check
  check (
    slot_type_id <> 'physical_healing'
    or (
      -- start_time/end_time are stored as true UTC instants, so convert back
      -- to local Philippine time before checking the hour range - comparing
      -- the raw UTC clock digits here was the same class of bug as the one
      -- in generate_slots_for_healer().
      extract(dow from start_time at time zone 'Asia/Manila') between 2 and 5
      and (start_time at time zone 'Asia/Manila')::time >= time '14:00'
      and (end_time at time zone 'Asia/Manila')::time <= time '17:00'
    )
  );

-- Physical sessions are paid in person at the office, not verified from
-- an uploaded screenshot/receipt.
alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check
  check (payment_method in ('qr_maribank', 'paypal', 'package', 'pay_at_office'));


-- ============================================================
-- Payment / payout tracking.
-- Split on every completed booking: 38% Pranic Healing Foundation of the
-- Philippines, 38% the Pranic Healer, 6% whoever referred the patient,
-- 18% Project HOPE admin. One payouts row per booking, created when
-- admin sets the session's amount; admin then separately marks/uploads
-- proof that the healer's cut was actually sent, and uploads a receipt
-- for the patient.
-- ============================================================

alter table public.slot_types add column if not exists price numeric(10,2);
update public.slot_types set price = 500 where id = 'consultation' and price is null;
update public.slot_types set price = 2500 where id = 'healing' and price is null;
update public.slot_types set price = 2500 where id = 'physical_healing' and price is null;

-- Correct pricing, per Project HOPE's rate sheet: Consultation PHP 500/session,
-- Pranic Healing Session (online/distant or physical/onsite) PHP 2500/session.
-- Unconditional (not "where price is null") so it corrects whatever's there now.
update public.slot_types set price = 500 where id = 'consultation';
update public.slot_types set price = 2500 where id = 'healing';
update public.slot_types set price = 2500 where id = 'physical_healing';

alter table public.bookings add column if not exists amount numeric(10,2);

-- Separate flag from reminder_sent (which is now specifically the 1-hour-
-- before reminder), so the 15-minutes-before "Zoom is open" nudge can be
-- tracked and sent independently without re-triggering the 1-hour one.
alter table public.bookings add column if not exists reminder_15min_sent boolean not null default false;

-- Who brought this patient in, so the 6% referral line has a name attached.
-- Free text rather than a hard reference - referrers aren't necessarily
-- users of the system (could be a friend, a healer, a past patient, etc).
alter table public.profiles add column if not exists referred_by_name text;

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,

  total_amount numeric(10,2) not null,
  foundation_amount numeric(10,2) not null,  -- 38% Pranic Healing Foundation of the Philippines
  healer_amount numeric(10,2) not null,      -- 38% the Pranic Healer
  referral_amount numeric(10,2) not null,    -- 6% whoever referred the patient
  admin_amount numeric(10,2) not null,       -- 18% Project HOPE admin

  healer_paid boolean not null default false,
  healer_paid_at timestamptz,
  healer_payment_proof_url text,   -- admin-uploaded screenshot proving the healer was paid

  patient_receipt_url text,        -- admin-uploaded receipt for what the patient paid
  patient_receipt_sent_at timestamptz,

  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);

alter table public.payouts enable row level security;

drop policy if exists "Healer views own payouts" on public.payouts;
create policy "Healer views own payouts" on public.payouts
  for select using (
    exists (select 1 from public.bookings b where b.id = payouts.booking_id and b.healer_id = auth.uid())
  );

drop policy if exists "Patient views own payouts" on public.payouts;
create policy "Patient views own payouts" on public.payouts
  for select using (
    exists (select 1 from public.bookings b where b.id = payouts.booking_id and b.patient_id = auth.uid())
  );

drop policy if exists "Admin manages payouts" on public.payouts;
create policy "Admin manages payouts" on public.payouts
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- Computes and upserts the 38/38/6/18 split for a booking. Admin calls this
-- with the actual amount charged (pre-filled from the session's default
-- price, editable in case of a discount/custom rate).
create or replace function public.upsert_payout(p_booking_id uuid, p_total_amount numeric)
returns void
language plpgsql
security definer
as $$
begin
  if public.current_role() != 'admin' then
    raise exception 'Only admin can set payout amounts';
  end if;

  insert into public.payouts (
    booking_id, total_amount, foundation_amount, healer_amount, referral_amount, admin_amount, created_by
  ) values (
    p_booking_id,
    p_total_amount,
    round(p_total_amount * 0.38, 2),
    round(p_total_amount * 0.38, 2),
    round(p_total_amount * 0.06, 2),
    round(p_total_amount * 0.18, 2),
    auth.uid()
  )
  on conflict (booking_id) do update
    set total_amount = excluded.total_amount,
        foundation_amount = excluded.foundation_amount,
        healer_amount = excluded.healer_amount,
        referral_amount = excluded.referral_amount,
        admin_amount = excluded.admin_amount;

  update public.bookings set amount = p_total_amount where id = p_booking_id;
end;
$$;

grant execute on function public.upsert_payout(uuid, numeric) to authenticated;

-- Storage for admin-uploaded proof of paying the healer, and patient receipts.
-- Both private - only admin, and the specific healer/patient involved, can see them.
insert into storage.buckets (id, name, public) values ('healer-payout-proofs', 'healer-payout-proofs', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('patient-receipts', 'patient-receipts', false)
on conflict (id) do nothing;

drop policy if exists "Admin manages healer payout proofs" on storage.objects;
create policy "Admin manages healer payout proofs"
on storage.objects for all
using (bucket_id = 'healer-payout-proofs' and public.current_role() = 'admin')
with check (bucket_id = 'healer-payout-proofs' and public.current_role() = 'admin');

drop policy if exists "Healer views own payout proofs" on storage.objects;
create policy "Healer views own payout proofs"
on storage.objects for select
using (
  bucket_id = 'healer-payout-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admin manages patient receipts" on storage.objects;
create policy "Admin manages patient receipts"
on storage.objects for all
using (bucket_id = 'patient-receipts' and public.current_role() = 'admin')
with check (bucket_id = 'patient-receipts' and public.current_role() = 'admin');

drop policy if exists "Patient views own receipts" on storage.objects;
create policy "Patient views own receipts"
on storage.objects for select
using (
  bucket_id = 'patient-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- Session packages: patient picks/buys a package, admin approves the
-- purchase (same pattern as approving a regular booking's payment),
-- then the patient books their own slots on the normal calendar,
-- choosing "use my package" instead of uploading a proof each time.
-- ============================================================

-- Fix: packages.id defaults to a random uuid, so the earlier
-- "insert ... on conflict do nothing" never actually had anything to
-- conflict on - every re-run of this file quietly inserted two more
-- duplicate package rows. This dedupes what's already there (safely
-- repointing any real purchases in patient_packages to the surviving row
-- first, so nothing gets orphaned) and adds a real unique constraint so
-- this can't happen again - the original insert above becomes correctly
-- idempotent retroactively once this constraint exists.
-- ============================================================
do $$
declare
  canonical record;
begin
  for canonical in (
    select distinct on (name) id, name
    from public.packages
    order by name, id asc
  ) loop
    update public.patient_packages pp
    set package_id = canonical.id
    where pp.package_id in (
      select id from public.packages where name = canonical.name and id <> canonical.id
    );

    delete from public.packages where name = canonical.name and id <> canonical.id;
  end loop;
end $$;

alter table public.packages drop constraint if exists packages_name_key;
alter table public.packages add constraint packages_name_key unique (name);

insert into public.packages (name, description, slot_type_id, session_count, price) values
  ('3-Session Pranic Healing Package', 'Includes a bonus Healing Kit.', 'healing', 3, 7000),
  ('6-Session Pranic Healing Package', 'Includes a bonus Healing Kit. Our best value for ongoing healing.', 'healing', 6, 14000)
on conflict (name) do nothing;

-- Tighten patient_packages: patients could previously update their own row
-- directly (including payment_status and sessions_remaining), which would
-- let someone grant themselves free session credits via the API directly.
-- Only admin updates it now; patients redeem a session through the
-- security-definer function below instead, which enforces the real rules.
drop policy if exists "Admins verify/update packages" on public.patient_packages;
create policy "Admins verify/update packages" on public.patient_packages
  for update using (public.current_role() = 'admin');

-- Atomically spends one session credit when a patient books using a
-- package, refusing if the package isn't approved yet or has none left -
-- security definer so it can update the row despite the tightened policy
-- above, but only after verifying the caller actually owns this package.
create or replace function public.redeem_package_session(p_patient_package_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  pkg record;
begin
  select * into pkg from public.patient_packages where id = p_patient_package_id;

  if pkg is null or pkg.patient_id != auth.uid() then
    raise exception 'Package not found';
  end if;
  if pkg.payment_status != 'booked' then
    raise exception 'This package has not been approved yet';
  end if;
  if pkg.sessions_remaining <= 0 then
    raise exception 'No sessions remaining on this package';
  end if;

  update public.patient_packages
  set sessions_remaining = sessions_remaining - 1
  where id = p_patient_package_id;
end;
$$;

grant execute on function public.redeem_package_session(uuid) to authenticated;

-- Gives a session credit back if admin releases/cancels a booking that was
-- paid for with a package.
create or replace function public.restore_package_session(p_patient_package_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if public.current_role() != 'admin' then
    raise exception 'Only admin can restore a package session';
  end if;

  update public.patient_packages
  set sessions_remaining = sessions_remaining + 1
  where id = p_patient_package_id;
end;
$$;

grant execute on function public.restore_package_session(uuid) to authenticated;

-- ============================================================
-- Public healer directory support.
--
-- The "profiles" table's select policy is `id = auth.uid()` only, which
-- means even a logged-in *patient* can't actually read a healer's name via
-- the existing joins used on the healer-browsing pages (the healer's row
-- isn't their own row) - RLS silently drops it. This narrow view exposes
-- just the display name of active, approved healers (nothing sensitive
-- like email/phone/reason_for_healing) to anyone, including logged-out
-- visitors, without loosening the real profiles table at all.
-- ============================================================
create or replace view public.healer_public_profiles as
select p.id, p.nickname, p.full_name
from public.profiles p
join public.healer_profiles hp on hp.user_id = p.id
where hp.is_active = true and hp.approval_status = 'approved';

grant select on public.healer_public_profiles to anon, authenticated;

-- Let anyone (including logged-out visitors) see active/approved healer
-- profiles, categories, and category assignments - additive alongside the
-- existing authenticated-only policies, so nothing already working changes.
drop policy if exists "Anyone can view active approved healer profiles" on public.healer_profiles;
create policy "Anyone can view active approved healer profiles" on public.healer_profiles
  for select using (is_active = true and approval_status = 'approved');

drop policy if exists "Anyone can view categories" on public.categories;
create policy "Anyone can view categories" on public.categories
  for select using (true);

drop policy if exists "Anyone can view healer categories for public healers" on public.healer_categories;
create policy "Anyone can view healer categories for public healers" on public.healer_categories
  for select using (
    exists (
      select 1 from public.healer_profiles hp
      where hp.user_id = healer_categories.healer_id
        and hp.is_active = true and hp.approval_status = 'approved'
    )
  );

-- ============================================================
-- NDA / confidentiality agreement at signup (separate from the patient
-- intake form's consent_agreed, which covers different, fuller intake
-- info and gates booking access - this is just "I agree to keep things
-- confidential", required for both patients and healers at signup).
-- ============================================================
alter table public.profiles add column if not exists nda_agreed_at timestamptz;

-- ============================================================
-- Per-booking "main concern" - what the patient wants addressed in this
-- specific session, separate from their one-time intake reason_for_healing
-- since concerns can differ session to session. Shown to the healer.
-- ============================================================
alter table public.bookings add column if not exists main_concern text;

-- ============================================================
-- Post-session feedback / testimonials.
-- ============================================================
create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  healer_id uuid not null references public.healer_profiles(user_id) on delete cascade,

  star_rating int not null check (star_rating between 1 and 5),
  pain_scale int not null check (pain_scale between 0 and 10),
  symptoms_improved_pct int not null check (symptoms_improved_pct in (10, 25, 50, 75, 90, 100)),
  experience_text text,

  -- Required: confidentiality/data-use consent, same spirit as the intake form.
  confidentiality_consent boolean not null default false,
  -- Optional: separate, explicit permission to use the testimonial publicly
  -- (promotional/inspirational use). Only feedback with this checked shows
  -- up on a healer's public-facing profile - the required consent above is
  -- about internal handling, not public display permission.
  promotional_consent boolean not null default false,

  created_at timestamptz not null default now()
);

alter table public.session_feedback enable row level security;

drop policy if exists "Patients manage own feedback" on public.session_feedback;
create policy "Patients manage own feedback" on public.session_feedback
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

drop policy if exists "Healers view own session feedback" on public.session_feedback;
create policy "Healers view own session feedback" on public.session_feedback
  for select using (healer_id = auth.uid());

drop policy if exists "Admin manages feedback" on public.session_feedback;
create policy "Admin manages feedback" on public.session_feedback
  for all using (public.current_role() = 'admin');

-- Lets any logged-in user read testimonials the patient explicitly agreed
-- to make public, so they can show up on a healer's profile page for other
-- patients browsing - names/photos are deliberately NOT in this table at
-- all, only initials get computed client-side from the patient's own name.
drop policy if exists "Authenticated can view promotable testimonials" on public.session_feedback;
create policy "Authenticated can view promotable testimonials" on public.session_feedback
  for select using (promotional_consent = true and auth.role() = 'authenticated');

-- Accurate average/count across ALL feedback for a healer (not just the
-- publicly-consented ones), without exposing any individual non-consented
-- row - bypasses RLS via security definer but only ever returns aggregates.
create or replace function public.healer_feedback_stats(p_healer_id uuid)
returns table(avg_rating numeric, review_count int)
language sql
security definer
stable
as $$
  select coalesce(avg(star_rating), 0)::numeric(3,2), count(*)::int
  from public.session_feedback
  where healer_id = p_healer_id;
$$;

grant execute on function public.healer_feedback_stats(uuid) to authenticated;

-- Returns public testimonials for a healer with only computed initials -
-- never the patient's actual name or any photo reference - so the display
-- layer can't accidentally leak identity even if someone inspects the
-- network request.
create or replace function public.healer_testimonials(p_healer_id uuid)
returns table(
  id uuid,
  star_rating int,
  pain_scale int,
  symptoms_improved_pct int,
  experience_text text,
  patient_initials text,
  created_at timestamptz
)
language sql
security definer
stable
as $$
  select
    sf.id,
    sf.star_rating,
    sf.pain_scale,
    sf.symptoms_improved_pct,
    sf.experience_text,
    coalesce(
      nullif(upper(left(p.first_name, 1) || left(p.last_name, 1)), ''),
      upper(left(p.full_name, 1)) || '.'
    ) as patient_initials,
    sf.created_at
  from public.session_feedback sf
  join public.profiles p on p.id = sf.patient_id
  where sf.healer_id = p_healer_id and sf.promotional_consent = true
  order by sf.created_at desc;
$$;

grant execute on function public.healer_testimonials(uuid) to authenticated;

-- Separate from experience_text (which the patient may allow to be shown
-- publicly via promotional_consent) - this is always private, seen only by
-- the assigned healer and admin, never surfaced on any public profile
-- regardless of promotional_consent.
alter table public.session_feedback add column if not exists private_note text;

-- A separate, genuinely private note the patient can leave for their
-- healer specifically - distinct from experience_text, which is the
-- general feedback that may also become a public testimonial if
-- promotional_consent is checked. This field is never shown to admin in
-- the UI and never exposed via healer_testimonials().
alter table public.session_feedback add column if not exists private_note_to_healer text;
