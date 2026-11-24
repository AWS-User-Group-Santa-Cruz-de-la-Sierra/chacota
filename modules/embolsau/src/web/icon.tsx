import logo128 from './assets/embolsau-128.png';
import logo512 from './assets/embolsau-512.png';

/**
 * Embolsau's logo: the tatú in its sack with the checkered flag.
 * `color` is part of the ActivityWeb icon contract; the logo keeps its own colors.
 */
export function EmbolsauIcon({ size = 40 }: { size?: number; color?: string }) {
  return <img src={size > 64 ? logo512.src : logo128.src} width={size} height={size} alt="" aria-hidden="true" className="shrink-0 object-contain" />;
}
