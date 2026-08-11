import { NextResponse } from 'next/server';
import { sendEmail } from '../../../lib/gmail';

export async function POST(request) {
  const { fullName, role, email } = await request.json();

  const result = await sendEmail({
    to: process.env.GMAIL_USER,
    subject: `New ${role === 'healer' ? 'Pranic Healer' : 'patient'} sign-up — Project HOPE`,
    html: `
      <p>A new account was just created:</p>
      <ul>
        <li><strong>Name:</strong> ${fullName}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Role:</strong> ${role === 'healer' ? 'Pranic Healer' : 'Patient'}</li>
      </ul>
      ${role === 'healer' ? '<p>This healer is pending your approval in the admin dashboard.</p>' : ''}
    `,
  });

  return NextResponse.json(result);
}