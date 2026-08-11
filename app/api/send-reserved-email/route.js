import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendEmail } from '../../../lib/gmail';

export async function POST(request) {
  const { bookingId } = await request.json();
  console.log('send-reserved-email received bookingId:', bookingId);

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(
      '*, profiles!bookings_patient_id_fkey(full_name, email), healer_profiles(profiles(full_name)), slots(start_time, slot_types(label))'
    )
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    console.log('send-reserved-email lookup error:', error);
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
  }

  const patientEmail = booking.profiles?.email;
  if (!patientEmail) {
    return NextResponse.json({ success: false, error: 'No patient email on file' }, { status: 400 });
  }

  const sessionTime = new Date(booking.slots?.start_time).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const isOnsite = booking.payment_method === 'pay_at_office';

  const result = await sendEmail({
    to: patientEmail,
    subject: isOnsite
      ? 'Your onsite session is reserved — Project HOPE'
      : 'Your booking is reserved — Project HOPE - Online Pranic Healing Sessions',
    html: isOnsite
      ? `
      <p>Hi ${booking.profiles?.full_name || 'there'},</p>
      <p>We've received your booking request for an in-person session at the <strong>PHFP Ortigas Center</strong>:</p>
      <ul>
        <li><strong>Session:</strong> ${booking.slots?.slot_types?.label}</li>
        <li><strong>Healer:</strong> ${booking.healer_profiles?.profiles?.full_name}</li>
        <li><strong>Date & time:</strong> ${sessionTime}</li>
      </ul>
      <p>Your status is currently <strong>Reserved</strong>. No online payment is needed — please
      settle payment at the office when you arrive. We'll confirm your booking once we see you there.</p>
      <p style="color:#64748b;font-size:13px;">If you don't see our emails in your inbox, please also check
      your Spam/Junk folder and mark us as "Not spam" so future emails come through.</p>
      <p>Thank you,<br/>Project HOPE Team</p>
    `
      : `
      <p>Hi ${booking.profiles?.full_name || 'there'},</p>
      <p>We've received your booking request and are holding your slot while we verify your payment:</p>
      <ul>
        <li><strong>Session:</strong> ${booking.slots?.slot_types?.label}</li>
        <li><strong>Healer:</strong> ${booking.healer_profiles?.profiles?.full_name}</li>
        <li><strong>Date & time:</strong> ${sessionTime}</li>
      </ul>
<p>Your status is currently <strong>Reserved</strong>. Once we verify your payment, you'll receive
      a confirmation email with your Zoom link.</p>
      <p style="color:#64748b;font-size:13px;">If you don't see our emails in your inbox, please also check
      your Spam/Junk folder and mark us as "Not spam" so future emails come through.</p>
      <p>Thank you,<br/>Project HOPE Team</p>
    `,
  });
sendEmail({
    to: process.env.GMAIL_USER,
    subject: `New reservation — ${booking.profiles?.full_name || 'a patient'}`,
    html: `
      <p>A new booking was just reserved ${isOnsite ? '(onsite, pay at office)' : 'and is awaiting payment verification'}:</p>
      <ul>
        <li><strong>Patient:</strong> ${booking.profiles?.full_name}</li>
        <li><strong>Healer:</strong> ${booking.healer_profiles?.profiles?.full_name}</li>
        <li><strong>Session:</strong> ${booking.slots?.slot_types?.label}</li>
        <li><strong>Date & time:</strong> ${sessionTime}</li>
      </ul>
      <p>Please check the admin dashboard to confirm ${isOnsite ? 'this booking once payment is collected' : 'payment'}.</p>
    `,
  }).catch((err) => console.error('Failed to notify admin of reservation:', err));
  return NextResponse.json(result);
}
