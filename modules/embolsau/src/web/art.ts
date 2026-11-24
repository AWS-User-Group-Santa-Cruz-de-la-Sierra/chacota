import type { Animal } from '../model';
import backdrop from './assets/fondo.jpg';
import track from './assets/pista.jpg';
import capibaraDown from './assets/capibara-down.png';
import capibaraIcon from './assets/capibara-icon.png';
import capibaraRun from './assets/capibara-run.png';
import jochiDown from './assets/jochi-down.png';
import jochiIcon from './assets/jochi-icon.png';
import jochiRun from './assets/jochi-run.png';
import nanduDown from './assets/nandu-down.png';
import nanduIcon from './assets/nandu-icon.png';
import nanduRun from './assets/nandu-run.png';
import tatuDown from './assets/tatu-down.png';
import tatuIcon from './assets/tatu-icon.png';
import tatuRun from './assets/tatu-run.png';

/**
 * Each critter's pictures, square with a transparent background, facing right, sack included:
 * running (feet near the bottom edge), fallen (drawn already lying down), and the icon to pick it.
 * Final art: to change it, replace the files and keep the names.
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

/**
 * The scenery: dark earth for the track (seamless, 20 m wide) and the Santa Cruz flora behind it
 * (motacú and toborochi, seamless), both by the maintainer.
 */
export const SCENERY = { track: track.src, backdrop: backdrop.src };
