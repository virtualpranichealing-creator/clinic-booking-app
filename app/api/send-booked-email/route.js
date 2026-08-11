import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendEmail } from '../../../lib/gmail';
import { ZOOM_LINK, ZOOM_MEETING_ID, ZOOM_PASSCODE_NOTE, needsZoom, firstNameOf } from '../../../lib/zoomDetails';

export async function POST(request) {
  const { bookingId, zoomLink } = await request.json();

  // Kept for backward compatibility if a Zoom link is ever passed in
  // manually, but the standing room above is used by default now.
  if (zoomLink) {
    await supabaseAdmin.from('bookings').update({ zoom_link: zoomLink }).eq('id', bookingId);
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(
      '*, profiles!bookings_patient_id_fkey(full_name, first_name, nickname, email), healer_profiles(profiles(full_name, nickname)), slots(start_time, slot_types(label))'
    )
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
  }

  const patientEmail = booking.profiles?.email;
  if (!patientEmail) {
    return NextResponse.json({ success: false, error: 'No patient email on file' }, { status: 400 });
  }

  const sessionDate = new Date(booking.slots?.start_time).toLocaleDateString('en-US', {
    dateStyle: 'full',
  });
  const sessionTime = new Date(booking.slots?.start_time).toLocaleTimeString('en-US', {
    timeStyle: 'short',
  });

  const isOnsite = booking.payment_method === 'pay_at_office';
  const healerName = booking.healer_profiles?.profiles?.nickname || booking.healer_profiles?.profiles?.full_name;
  const patientFirstName = firstNameOf(booking.profiles);

  const zoomBlock = needsZoom(booking)
    ? `
      <p><strong>Platform:</strong> Zoom</p>
      <p><strong>Zoom Meeting Details:</strong><br/>
      <a href="${booking.zoom_link || ZOOM_LINK}">${booking.zoom_link || ZOOM_LINK}</a><br/>
      Zoom ID: ${ZOOM_MEETING_ID}<br/>
      ${ZOOM_PASSCODE_NOTE} &lt;3</p>
    `
    : '';

  const html = isOnsite
    ? `
      <p>Dear ${patientFirstName},</p>
      <p>Thank you for booking your Pranic Healing session with <strong>${healerName}</strong> through Project HOPE.</p>
      <p>We are pleased to confirm your in-person appointment at the <strong>PHFP Ortigas Center</strong>:</p>
      <p><strong>Date:</strong> ${sessionDate}<br/>
      <strong>Time:</strong> ${sessionTime} (Philippine Time)</p>
      <p>Please arrive a few minutes early. Payment for this session is settled at the office.</p>
      <p style="color:#64748b;font-size:13px;">If you don't see our emails in your inbox, please also check
      your Spam/Junk folder and mark us as "Not spam" so future emails come through.</p>
      <p>Thank you,<br/>Project HOPE Team</p>
    `
    : booking.delivery_preference === 'distant'
    ? `
      <p>Dear ${patientFirstName},</p>
      <p>Thank you for booking your Pranic Healing session with <strong>${healerName}</strong> through Project HOPE.</p>
      <p>We are pleased to confirm your distant healing appointment:</p>
      <p><strong>Date:</strong> ${sessionDate}<br/>
      <strong>Time:</strong> ${sessionTime} (Philippine Time)</p>
      <p>You don't need to join a call for this one — your healer will perform the healing remotely
      at your scheduled time. To prepare:</p>
      <ul>
        <li>Find a quiet, comfortable, and uninterrupted space where you can fully relax during the healing</li>
        <li>Wear comfortable clothing and make yourself as comfortable as possible, whether seated or lying down</li>
        <li>If possible, take a bath before your session. After the healing, it's best not to bathe immediately, so your body has time to absorb and integrate the healing energy</li>
      </ul>
      <p style="color:#64748b;font-size:13px;">If you don't see our emails in your inbox, please also check
      your Spam/Junk folder and mark us as "Not spam" so future emails come through.</p>
      <p>Thank you,<br/>Project HOPE Team</p>
    `
    : `
      <p>Dear ${patientFirstName},</p>
      <p>Thank you for booking your Pranic Healing session with <strong>${healerName}</strong> through Project HOPE.</p>
      <p>We are pleased to confirm your appointment on:</p>
      <p><strong>Date:</strong> ${sessionDate}<br/>
      <strong>Time:</strong> ${sessionTime} (Philippine Time)</p>
      ${zoomBlock}
      <p><strong>Preparing for Your Healing Session</strong></p>
      <p>To help you receive the greatest benefit from your session, we recommend the following:</p>
      <ul>
        <li>Find a quiet, comfortable, and uninterrupted space where you can fully relax during the healing</li>
        <li>Wear comfortable clothing and make yourself as comfortable as possible, whether seated or lying down</li>
        <li>If possible, take a bath before your session. After the healing, it is recommended not to bathe immediately, as this allows your body more time to absorb and integrate the healing energy</li>
        <li>Please join the Zoom meeting a few minutes before your scheduled appointment to ensure everything is ready</li>
      </ul>
      <p style="color:#64748b;font-size:13px;">If you don't see our emails in your inbox, please also check
      your Spam/Junk folder and mark us as "Not spam" so future emails come through.</p>
      <p>Thank you,<br/>Project HOPE Team</p>
    `;

  const result = await sendEmail({
    to: patientEmail,
    subject: isOnsite
      ? 'Your onsite session is confirmed — Project HOPE'
      : 'Your Pranic Healing session is confirmed — Project HOPE',
    html,
  });

  return NextResponse.json(result);
}
