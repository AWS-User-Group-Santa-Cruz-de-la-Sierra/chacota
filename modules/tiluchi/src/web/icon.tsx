import logo128 from './assets/tiluchi-128.png';
import logo512 from './assets/tiluchi-512.png';

/**
 * Tiluchi's logo: the hornero (tiluchi) with a question mark on its wing, on its clay oven.
 * `color` is part of the ActivityWeb icon contract; the logo keeps its own colors.
 */
export function TiluchiIcon({ size = 40 }: { size?: number; color?: string }) {
  return <img src={size > 64 ? logo512.src : logo128.src} width={size} height={size} alt="" aria-hidden="true" className="shrink-0 object-contain" />;
}
