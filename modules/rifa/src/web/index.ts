import type { ActivityWeb } from '@chacota/live/web';
import { RifaFinal } from './final';
import { RifaHost } from './host';
import { RifaIcon } from './icon';
import { RifaLobbySummary } from './lobby-summary';
import { RifaPlay } from './play';
import { RifaPlayFinal } from './play-final';

export const rifaWeb: ActivityWeb = {
  id: 'rifa',
  Icon: RifaIcon,
  Host: RifaHost,
  Play: RifaPlay,
  LobbySummary: RifaLobbySummary,
  Final: RifaFinal,
  PlayFinal: RifaPlayFinal,
};

export { RifaIcon };
