/** Embolsau's icon: a tied sack with a hopping line. `color` fills the sack. */
export function EmbolsauIcon({ size = 40, color = '#C9A46A' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path d="M14 18c0-3 4-5 10-5s10 2 10 5l3 20c0 4-6 6-13 6s-13-2-13-6z" fill={color} stroke="#1A0E2E" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 15c2-4 12-4 14 0" fill="none" stroke="#1A0E2E" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 9l-3-4m3 4l3-4" stroke="#FFC629" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 28h8" stroke="#1A0E2E" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
