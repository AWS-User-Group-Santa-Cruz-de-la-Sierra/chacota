/** Rifa's icon: the sombrero de saó, the duende's straw hat. `color` tints the woven stripes. */
export function RifaIcon({ size = 40, color = '#2E9E5B' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <path d="M22 40 C20 20 26 10 32 10 C38 10 44 20 42 40 Z" fill="#E8C875" stroke="#8A6A2A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22.4 33 H41.6 M23.4 26 H40.6 M25.5 19 H38.5" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M22 37 C18 38 6 40 6 46 C6 52 20 54 32 54 C44 54 58 52 58 46 C58 40 46 38 42 37 Z" fill="#F0D58E" stroke="#8A6A2A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 46 H50 M10 50 H54" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}
