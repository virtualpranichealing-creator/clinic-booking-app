// Sends an email via Resend's API. Server-side only (uses the secret API key).
export async function sendEmail({ to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Resend's shared test sender — works immediately with no domain setup.
      // Once you verify your own domain in Resend, switch this to something like
      // 'Virtual Pranic Healing <bookings@yourdomain.com>'
      from: 'Virtual Pranic Healing <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend error:', errorText);
    return { success: false, error: errorText };
  }
  return { success: true };
}
