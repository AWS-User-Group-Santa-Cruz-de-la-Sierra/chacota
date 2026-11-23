import type { ActivityWeb } from '@chacota/live/web';
import { TiluchiHost } from './host';
import { TiluchiIcon } from './icon';
import { TiluchiLobbySummary } from './lobby-summary';
import { TiluchiPlay } from './play';
import { TiluchiResultsDetails } from './results-details';

export const tiluchiWeb: ActivityWeb = {
  id: 'tiluchi',
  Icon: TiluchiIcon,
  Host: TiluchiHost,
  Play: TiluchiPlay,
  ResultsDetails: TiluchiResultsDetails,
  LobbySummary: TiluchiLobbySummary,
};

export { AnswerIcon, ANSWER_STYLES } from './answer-icons';
export { AnswerTiles, choiceLabel } from './answer-grid';
export { TiluchiIcon };
