import type { ActivityWeb } from '@chacota/live/web';
import { EmbolsauHost } from './host';
import { EmbolsauIcon } from './icon';
import { EmbolsauLobbySummary } from './lobby-summary';
import { EmbolsauPlay } from './play';
import { EmbolsauResultsDetails } from './results-details';

export const embolsauWeb: ActivityWeb = {
  id: 'embolsau',
  Icon: EmbolsauIcon,
  Host: EmbolsauHost,
  Play: EmbolsauPlay,
  ResultsDetails: EmbolsauResultsDetails,
  LobbySummary: EmbolsauLobbySummary,
};

export { EmbolsauIcon };
