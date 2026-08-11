import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendEmail } from '../../../lib/gmail';
import { ZOOM_LINK, ZOOM_MEETING_ID, ZOOM_PASSCODE_NOTE, needsZoom, firstNameOf } from '../../../lib/zoomDetails';

// Only real-time online sessions (and consultations) actually need a "the
// Zoom room is open, come in" nudge - onsite patients aren't joining
// anything, and distant healing doesn't involve a live call either. Those
// bookings still get marked as handled below so this cron stops rechecking
// them, they just don't get an email.
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const fifteenMinFromNow = new Date(now.getTime() + 15 * 60000);

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(
      '*, profiles!bookings_patient_id_fkey(full_name, first_name, nickname, email), healer_profiles(profiles(full_name, first_name, nickname, email)), slots(start_time, slot_types(label))'
    )
    .eq('status', 'booked')
    .eq('reminder_15min_sent', false)
    .gte('slots.start_time', now.toISOString())
    .lte('slots.start_time', fifteenMinFromNow.toISOString());

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const results = [];
  for (const booking of bookings || []) {
    if (!booking.slots?.start_time) continue;

    if (!needsZoom(booking)) {
      // Onsite or distant - nothing to send, just mark as handled.
      await supabaseAdmin.from('bookings').update({ reminder_15min_sent: true }).eq('id', booking.id);
      results.push({ bookingId: booking.id, skipped: true });
      continue;
    }

    const healerName = booking.healer_profiles?.profiles?.nickname || booking.healer_profiles?.profiles?.full_name;
    const patientName = booking.profiles?.full_name;
    const patientFirstName = firstNameOf(booking.profiles);
    const healerFirstName = firstNameOf(booking.healer_profiles?.profiles);

    const zoomLine = `
      <a href="${booking.zoom_link || ZOOM_LINK}">${booking.zoom_link || ZOOM_LINK}</a><br/>
      Zoom ID: ${ZOOM_MEETING_ID}<br/>
      ${ZOOM_PASSCODE_NOTE} &lt;3
    `;

    let patientSent = { success: true, skipped: true };
    let healerSent = { success: true, skipped: true };

    const patientEmail = booking.profiles?.email;
    if (patientEmail) {
      patientSent = await sendEmail({
        to: patientEmail,
        subject: 'Zoom is now open — your session starts in 15 minutes 🌿',
        html: `
          <p>Hello ${patientFirstName},</p>
          <p>Just a quick note — the Zoom room for your Pranic Healing session with
          <strong>${healerName}</strong> is <strong>now open</strong>! Feel free to join early and settle in.</p>
          <p>${zoomLine}</p>
          <p>See you soon! 🌿✨</p>
        `,
      });
    }

    const healerEmail = booking.healer_profiles?.profiles?.email;
    if (healerEmail) {
      healerSent = await sendEmail({
        to: healerEmail,
        subject: `Zoom is now open — session with ${patientName} starts in 15 minutes`,
        html: `
          <p>Hello ${healerFirstName},</p>
          <p>The Zoom room for your session with <strong>${patientName}</strong> is <strong>now open</strong>.</p>
          <p>${zoomLine}</p>
          <p>Thank you for sharing your healing presence. 🙏✨</p>
        `,
      });
    }

    if (patientSent.success && healerSent.success) {
      await supabaseAdmin.from('bookings').update({ reminder_15min_sent: true }).eq('id', booking.id);
    }
    results.push({ bookingId: booking.id, patientSent, healerSent });
  }

  return NextResponse.json({ processed: results.length, results });
}
