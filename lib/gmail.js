import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Same shape as the old Resend-based sendEmail(), so the routes calling it
// don't need to change how they use the result.
export async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: `"Virtual Pranic Healing" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('Gmail send error:', err);
    return { success: false, error: err.message };
  }
}