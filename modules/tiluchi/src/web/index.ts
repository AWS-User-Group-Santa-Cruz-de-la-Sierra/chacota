import type { ActivityWeb } from '@chacota/live/web';
import { TiluchiHost } from './host';
import { TiluchiIcon } from './icon';
import { TiluchiPlay } from './play';
import { TiluchiResultsDetails } from './results-details';

export const tiluchiWeb: ActivityWeb = {
  id: 'tiluchi',
  Icon: TiluchiIcon,
  Host: TiluchiHost,
  Play: TiluchiPlay,
  ResultsDetails: TiluchiResultsDetails,
};

export { AnswerIcon, ANSWER_STYLES } from './answer-icons';
export { AnswerTiles, choiceLabel } from './answer-grid';
export { TiluchiIcon };
