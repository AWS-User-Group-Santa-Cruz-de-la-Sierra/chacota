/** Answer symbols: luna, hoja, flor de tajibo y sol. One per answer slot, never color alone. */
export const ANSWER_STYLES = [
  { name: 'luna', bg: 'bg-morado', fg: 'text-blanco' },
  { name: 'hoja', bg: 'bg-verde', fg: 'text-blanco' },
  { name: 'tajibo', bg: 'bg-tajibo', fg: 'text-blanco' },
  { name: 'sol', bg: 'bg-sol', fg: 'text-noche' },
] as const;

export function AnswerIcon({ index, size = 28 }: { index: number; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 28 28', 'aria-hidden': true } as const;
  switch (index % 4) {
    case 0:
      return (
        <svg {...props}>
          <path d="M17 3a11 11 0 1 0 8 18A9 9 0 0 1 17 3z" fill="currentColor" />
        </svg>
      );
    case 1:
      return (
        <svg {...props}>
          <path d="M4 24C4 12 12 4 24 4c0 12-8 20-20 20z" fill="currentColor" />
          <path d="M7 21L18 10" stroke="#0B8048" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 2:
      return (
        <svg {...props}>
          <g fill="currentColor">
            <circle cx="14" cy="6.5" r="5.2" />
            <circle cx="21.6" cy="11.7" r="5.2" />
            <circle cx="18.7" cy="20.5" r="5.2" />
            <circle cx="9.3" cy="20.5" r="5.2" />
            <circle cx="6.4" cy="11.7" r="5.2" />
          </g>
          <circle cx="14" cy="14" r="2.8" fill="#D63A72" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="14" cy="14" r="6" fill="currentColor" />
          <path
            d="M14 2v3M14 23v3M2 14h3M23 14h3M5.5 5.5l2.1 2.1M20.4 20.4l2.1 2.1M5.5 22.5l2.1-2.1M20.4 7.6l2.1-2.1"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
