'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { buttonClass } from './ui';

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant)}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
