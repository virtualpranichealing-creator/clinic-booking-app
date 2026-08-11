import './globals.css';

export const metadata = {
  title: 'Project HOPE - Book your Pranic Healing Sessions',
  description: 'Book pranic healing sessions with our healers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Yellowtail&family=Fraunces:wght@600;700;800&family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-white text-brand-ink">{children}</body>
    </html>
  );
}
