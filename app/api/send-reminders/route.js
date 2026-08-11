import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendEmail } from '../../../lib/gmail';
import { ZOOM_LINK, ZOOM_MEETING_ID, ZOOM_PASSCODE_NOTE, needsZoom, firstNameOf } from '../../../lib/zoomDetails';

const PRIVACY_NOTICE_PATIENT = `
  <p>🔒 <strong>Privacy &amp; Confidentiality Notice</strong><br/>
  The session may be recorded for documentation and quality purposes. Any recording will be kept
  strictly confidential and private and will only be handled by authorized individuals. Your privacy
  will be respected at all times.</p>
`;

const PRIVACY_NOTICE_HEALER = `
  <p>🔒 <strong>Privacy &amp; Confidentiality</strong><br/>
  Please note that the session may be recorded for documentation and quality purposes. Any recording
  should be kept strictly confidential and private and must not be shared or distributed without
  proper authorization. Please also maintain the client's privacy and confidentiality regarding
  anything discussed or experienced during the session.</p>
`;

function zoomBlockHtml(booking) {
  if (!needsZoom(booking)) return '';
  return `
    <p><strong>Platform:</strong> Zoom<br/>
    <strong>Zoom Meeting Details:</strong><br/>
    <a href="${booking.zoom_link || ZOOM_LINK}">${booking.zoom_link || ZOOM_LINK}</a><br/>
    Zoom ID: ${ZOOM_MEETING_ID}<br/>
    ${ZOOM_PASSCODE_NOTE} &lt;3</p>
  `;
}

export async function GET(request) {
  // Simple shared-secret check so only your actual cron job can trigger this
  // (skips the check entirely if CRON_SECRET isn't set, so this stays
  // optional and won't break anything if you haven't configured it yet).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60000);

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(
      '*, profiles!bookings_patient_id_fkey(full_name, first_name, nickname, email), healer_profiles(profiles(full_name, first_name, nickname, email)), slots(start_time, slot_types(label))'
    )
    .eq('status', 'booked')
    .eq('reminder_sent', false)
    .gte('slots.start_time', now.toISOString())
    .lte('slots.start_time', oneHourFromNow.toISOString());

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const results = [];
  for (const booking of bookings || []) {
    if (!booking.slots?.start_time) continue;

    const sessionTime = new Date(booking.slots.start_time).toLocaleTimeString('en-US', {
      timeStyle: 'short',
    });
    const sessionDate = new Date(booking.slots.start_time).toLocaleDateString('en-US', {
      dateStyle: 'full',
    });

    const isOnsite = booking.payment_method === 'pay_at_office';
    const isDistant = booking.delivery_preference === 'distant';
    const healerName = booking.healer_profiles?.profiles?.nickname || booking.healer_profiles?.profiles?.full_name;
    const patientName = booking.profiles?.full_name;
    const patientFirstName = firstNameOf(booking.profiles);
    const healerFirstName = firstNameOf(booking.healer_profiles?.profiles);

    let patientSent = { success: true, skipped: true };
    let healerSent = { success: true, skipped: true };

    // ---- Patient reminder ----
    const patientEmail = booking.profiles?.email;
    if (patientEmail) {
      const patientHtml = isOnsite
        ? `
          <p>Hello ${patientFirstName},</p>
          <p>This is a gentle reminder for your upcoming Pranic Healing session with <strong>${healerName}</strong> today at ${sessionTime}. ❤️</p>
          <p>Please head to the <strong>PHFP Ortigas Center</strong> and arrive a few minutes early. Don't forget to bring your payment for the session.</p>
          <p>We look forward to having you with us. See you later! 🌿✨</p>
        `
        : isDistant
        ? `
          <p>Hello ${patientFirstName},</p>
          <p>This is a gentle reminder for your upcoming distant Pranic Healing session with <strong>${healerName}</strong> today at ${sessionTime}. ❤️</p>
          <p>You don't need to join a call - your healer will perform the healing remotely at this time. Before the session, please:</p>
          <ul>
            <li>Prepare a quiet and conducive space where you can relax comfortably during the healing</li>
            <li>It is advisable to take a bath before the session, as you will be encouraged not to bathe immediately afterward, to allow you to fully absorb the healing energy</li>
          </ul>
          ${PRIVACY_NOTICE_PATIENT}
          <p>We look forward to having you with us. See you later! 🌿✨</p>
        `
        : `
          <p>Hello ${patientFirstName},</p>
          <p>This is a gentle reminder for your upcoming Pranic Healing session with <strong>${healerName}</strong> today at ${sessionTime}. ❤️</p>
          ${zoomBlockHtml(booking)}
          <p>Before the session, please:</p>
          <ul>
            <li>Prepare a quiet and conducive space where you can relax comfortably during the healing</li>
            <li>It is advisable to take a bath before the session, as you will be encouraged not to bathe immediately afterward, to allow you to fully absorb the healing energy</li>
            <li>Please make sure you have a stable internet connection and are ready a few minutes before the scheduled time</li>
          </ul>
          ${PRIVACY_NOTICE_PATIENT}
          <p>We look forward to having you with us. See you later! 🌿✨</p>
        `;

      patientSent = await sendEmail({
        to: patientEmail,
        subject: 'Reminder: your Pranic Healing session starts in 1 hour',
        html: patientHtml,
      });
    }

    // ---- Healer reminder ----
    const healerEmail = booking.healer_profiles?.profiles?.email;
    if (healerEmail) {
      const healerHtml = isOnsite
        ? `
          <p>🌿 <strong>Healing Session Reminder</strong></p>
          <p>Hello ${healerFirstName}, good morning! Just a gentle reminder for your in-person session with <strong>${patientName}</strong> today at ${sessionTime}.</p>
          <p><strong>Location:</strong> PHFP Ortigas Center<br/>
          <strong>Date:</strong> ${sessionDate}<br/>
          <strong>Time:</strong> ${sessionTime} (Philippine Time)</p>
          ${PRIVACY_NOTICE_HEALER}
          <p>Thank you for sharing your healing presence and creating a safe and supportive space for the client. We truly appreciate your time, care, and dedication. 🙏✨</p>
        `
        : `
          <p>🌿 <strong>Healing Session Reminder</strong></p>
          <p>Hello ${healerFirstName}, good morning! Just a gentle reminder for your healing session with <strong>${patientName}</strong> today at ${sessionTime}.</p>
          <p>Please prepare a quiet and conducive space where you can conduct the session comfortably and without interruptions.</p>
          <p><strong>Date:</strong> ${sessionDate}<br/>
          <strong>Time:</strong> ${sessionTime} (Philippine Time)</p>
          ${zoomBlockHtml(booking)}
          ${PRIVACY_NOTICE_HEALER}
          <p>Thank you for sharing your healing presence and creating a safe and supportive space for the client. We truly appreciate your time, care, and dedication. 🙏✨</p>
        `;

      healerSent = await sendEmail({
        to: healerEmail,
        subject: `Reminder: session with ${patientName} in 1 hour`,
        html: healerHtml,
      });
    }

    if (patientSent.success && healerSent.success) {
      await supabaseAdmin.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);
    }
    results.push({ bookingId: booking.id, patientSent, healerSent });
  }

  return NextResponse.json({ processed: results.length, results });
}
