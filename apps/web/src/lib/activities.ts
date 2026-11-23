import { isActivityEnabled, type ActivityManifest } from '@chacota/core';

/** Why a new session of `module` cannot start, or null. Running sessions are never stopped by this. */
export function startSessionGuard(
  org: { activities?: string[] },
  module: string,
  manifests: ActivityManifest[],
): 'activity_disabled' | null {
  return isActivityEnabled(org, module, manifests) ? null : 'activity_disabled';
}
