import type { ActivityWeb } from '@chacota/live/web';
import { EmbolsauHost } from './host';
import { EmbolsauIcon } from './icon';
import { EmbolsauPlay } from './play';

export const embolsauWeb: ActivityWeb = {
  id: 'embolsau',
  Icon: EmbolsauIcon,
  Host: EmbolsauHost,
  Play: EmbolsauPlay,
};

export { EmbolsauIcon };
