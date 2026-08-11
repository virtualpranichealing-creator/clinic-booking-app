export default function HealerAvatarFallback({ size = 120 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="rounded-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf4fb" />
          <stop offset="100%" stopColor="#cfe8f5" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#sky)" />
      <path d="M0 68 Q25 50 50 68 T100 68 V100 H0 Z" fill="#8fbf6f" />
      <path d="M0 75 Q25 60 50 75 T100 75 V100 H0 Z" fill="#7bb05c" />
      <ellipse cx="38" cy="32" rx="16" ry="9" fill="white" />
      <ellipse cx="50" cy="28" rx="12" ry="7" fill="white" />
    </svg>
  );
}
