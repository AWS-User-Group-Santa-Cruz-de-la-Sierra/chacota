import 'server-only';
import { isActivityEnabled } from '@chacota/core';
import { notFound } from 'next/navigation';
import { manifests } from '@/activities/registry.server';

/** The activity's area only exists while the organization has it enabled. */
export function requireActivity(org: { activities?: string[] }, id: string): void {
  if (!isActivityEnabled(org, id, manifests)) notFound();
}
