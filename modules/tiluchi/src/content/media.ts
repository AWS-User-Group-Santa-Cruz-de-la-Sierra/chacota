import { isOrgMediaKey } from '@chacota/core';
import type { Question, Tiluchi } from './schema';

type WithMedia = Pick<Tiluchi, 'backgroundKey'> & { questions: Question[] };

/** Every image key a tiluchi uses (background, and each question's image and background). */
export function tiluchiMediaKeys(t: WithMedia): string[] {
  return [t.backgroundKey, ...t.questions.flatMap((q) => [q.imageKey, q.backgroundKey])].filter((k): k is string => !!k);
}

/** Removes keys that don't belong to the org (e.g. a JSON exported by another org). */
export function dropForeignMedia<T extends WithMedia>(t: T, orgId: string): { tiluchi: T; removed: number } {
  let removed = 0;
  const keep = <O extends { backgroundKey?: string; imageKey?: string }>(o: O, field: 'backgroundKey' | 'imageKey'): O => {
    const key = o[field];
    if (key === undefined || isOrgMediaKey(key, orgId)) return o;
    removed++;
    const { [field]: _dropped, ...rest } = o;
    return rest as O;
  };
  if (tiluchiMediaKeys(t).every((k) => isOrgMediaKey(k, orgId))) return { tiluchi: t, removed: 0 };
  const questions = t.questions.map((q) => keep(keep(q, 'imageKey'), 'backgroundKey'));
  return { tiluchi: { ...keep(t, 'backgroundKey'), questions }, removed };
}
