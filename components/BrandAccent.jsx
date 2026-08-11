// A decorative watercolor-leaf accent for the corner of branded pages
// (category picker, healer directory, healer profile), matching the
// Project HOPE brand.
export default function BrandAccent() {
  return (
    <svg
      className="absolute bottom-0 left-0 w-40 h-40 pointer-events-none opacity-70"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M0,160 Q40,140 50,100 Q70,130 110,120 Q80,140 80,160 Z" fill="#7FB07A" opacity="0.55" />
      <path d="M0,160 Q50,150 60,110 Q30,130 0,110 Z" fill="#4F8F52" opacity="0.7" />
      <path
        d="M8 150 L8 100 Q8 60 45 55 Q40 90 60 105 Q30 110 8 150 Z"
        stroke="#3D6B4A"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}
