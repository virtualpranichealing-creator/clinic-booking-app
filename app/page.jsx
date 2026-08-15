import Link from 'next/link';
import AppNav from '../components/AppNav';

export const metadata = {
  title: 'Project HOPE - Book your Pranic Healing Sessions',
};

export default function HomePage() {
  return (
    <div className="min-h-screen px-6">
      <AppNav />

      <main className="max-w-5xl mx-auto py-14">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h1 className="brand-heading-script">Project HOPE</h1>
          <p className="text-sm text-slate-500 mt-3 max-w-md mx-auto">
            Pranic Healing sessions with trusted healers — online, distant, or in person at our
            Ortigas center. Take the first step toward feeling better.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Link
            href="/login?next=/patient"
            className="brand-shell text-center py-12 hover:shadow-brandLg hover:-translate-y-0.5 transition-all"
          >
            <p className="text-4xl mb-3">🩺</p>
            <p className="text-xl font-display font-bold text-brand-green mb-1">Book a Consultation</p>
            <p className="text-sm text-slate-500">
              Not sure where to start? A consultation helps map out what kind of healing support
              fits you.
            </p>
          </Link>

          <div className="brand-shell text-center py-12">
            <p className="text-4xl mb-3">🌿</p>
            <Link href="/login?next=/patient/healers" className="block hover:opacity-80 transition-opacity">
              <p className="text-xl font-display font-bold text-brand-green mb-1">Book a Pranic Healer</p>
              <p className="text-sm text-slate-500">
                Browse our healers' profiles and book a Pranic Healing session directly with the
                one who feels right for you.
              </p>
            </Link>
            <Link
              href="/healers"
              className="inline-block mt-4 text-sm text-brand-green underline underline-offset-2 font-medium"
            >
              Browse Pranic Healers →
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          New here?{' '}
          <Link href="/signup" className="text-brand-green underline underline-offset-2">
            Create an account
          </Link>{' '}
          to get started.
        </p>
      </main>
    </div>
  );
}
