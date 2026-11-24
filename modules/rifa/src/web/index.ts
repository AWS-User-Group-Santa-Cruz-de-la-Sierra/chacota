import type { ActivityWeb } from '@chacota/live/web';
import { RifaHost } from './host';
import { RifaIcon } from './icon';
import { RifaPlay } from './play';

export const rifaWeb: ActivityWeb = {
  id: 'rifa',
  Icon: RifaIcon,
  Host: RifaHost,
  Play: RifaPlay,
};

export { RifaIcon };
