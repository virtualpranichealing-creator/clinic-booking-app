/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Slightly larger than Tailwind's defaults (xs: 12px→13px, sm: 14px→15px)
      // so the app's smallest, most-used text sizes stay legible on phones.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.5rem' }],
      },
      colors: {
        brand: {
          green: '#3D6B4A',
          greenLight: '#5C9B5C',
          greenDark: '#2A4D34',
          mint: '#DFEEDD',
          mintSoft: '#EEF6EC',
          ink: '#1F2E22',
          paper: '#FAFBF6',
        },
      },
      boxShadow: {
        brand: '0 1px 2px rgba(31, 46, 34, 0.04), 0 8px 24px -8px rgba(61, 107, 74, 0.18)',
        brandLg: '0 4px 12px rgba(31, 46, 34, 0.05), 0 20px 48px -16px rgba(61, 107, 74, 0.24)',
      },
      fontFamily: {
        script: ['Yellowtail', 'cursive'],
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
