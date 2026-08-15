import Link from 'next/link';
import AppNav from '../../components/AppNav';

export const metadata = {
  title: 'Contact Us — Project HOPE',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen px-6">
      <AppNav />

      <main className="max-w-3xl mx-auto py-14">
        <div className="text-center max-w-md mx-auto mb-10">
          <h1 className="brand-heading-script">Contact Us</h1>
          <p className="text-sm text-slate-500 mt-2">
            Have a question before booking? We'd love to hear from you.
          </p>
        </div>

        <div className="brand-shell max-w-md mx-auto">
          <div className="relative z-10 space-y-5 text-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-green/80 mb-1">Email</p>
              <a
                href="mailto:virtualpranichealing@gmail.com"
                className="text-lg font-medium text-brand-ink hover:text-brand-green transition-colors"
              >
                virtualpranichealing@gmail.com
              </a>
            </div>
            <div className="border-t border-brand-mint/60 pt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-green/80 mb-1">Phone</p>
              <a
                href="tel:+639777626781"
                className="text-lg font-medium text-brand-ink hover:text-brand-green transition-colors"
              >
                0977 762 6781
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
