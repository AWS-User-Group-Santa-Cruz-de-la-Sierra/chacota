export function ChacotaMark({ size = 40, color = '#6B2FD6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r="46" fill={color} />
      <path d="M22 58c0-17 12-30 28-30 13 0 22 8 24 18l12 4-12 5c-3 13-14 21-28 21-14 0-24-7-24-18z" fill="#FFC629" />
      <path d="M22 58c6 6 16 9 28 7 10-2 17-7 21-14" fill="none" stroke="#1A0E2E" strokeWidth="4" strokeLinecap="round" />
      <circle cx="58" cy="42" r="5" fill="#1A0E2E" />
      <circle cx="59.5" cy="40.5" r="1.6" fill="#FBF8FF" />
      <path d="M30 34l-6-10M38 30l-2-12" stroke="#F25C9A" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ChacotaMark size={size} />
      <span className="font-display font-extrabold tracking-tight" style={{ fontSize: size * 0.8 }}>
        chacota
      </span>
    </span>
  );
}
