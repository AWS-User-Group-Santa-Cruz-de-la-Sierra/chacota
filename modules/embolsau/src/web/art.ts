import type { Animal } from '../model';
import capibaraDown from './assets/capibara-down.svg';
import capibaraIcon from './assets/capibara-icon.svg';
import capibaraRun from './assets/capibara-run.svg';
import jochiDown from './assets/jochi-down.svg';
import jochiIcon from './assets/jochi-icon.svg';
import jochiRun from './assets/jochi-run.svg';
import nanduDown from './assets/nandu-down.svg';
import nanduIcon from './assets/nandu-icon.svg';
import nanduRun from './assets/nandu-run.svg';
import tatuDown from './assets/tatu-down.png';
import tatuIcon from './assets/tatu-icon.png';
import tatuRun from './assets/tatu-run.png';

/**
 * Each critter's pictures, square with a transparent background, facing right, sack included:
 * running (feet near the bottom edge), fallen (drawn already lying down), and the icon to pick it.
 * The tatú is final art; the rest are placeholders until theirs arrive (replace the files, keep the names).
 * Players are told apart by a colored shadow the screen draws under each one (BAGS).
 */
export const ART: Record<Animal, { run: string; down: string; icon: string }> = {
  jochi: { run: jochiRun.src, down: jochiDown.src, icon: jochiIcon.src },
  tatu: { run: tatuRun.src, down: tatuDown.src, icon: tatuIcon.src },
  nandu: { run: nanduRun.src, down: nanduDown.src, icon: nanduIcon.src },
  capibara: { run: capibaraRun.src, down: capibaraDown.src, icon: capibaraIcon.src },
};

/** Player colors (the shadow under each runner), indexed by bagOf(playerId). */
export const BAGS = ['#D63A72', '#FFC629', '#0B8048', '#8A5CF0', '#C9A46A', '#3FA7D6'];
