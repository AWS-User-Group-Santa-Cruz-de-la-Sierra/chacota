import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { buttonClass } from './ui';

/** The same "← back" everywhere: a ghost button sized like the other actions. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass('ghost', '-ml-4 self-start text-base')}>
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
