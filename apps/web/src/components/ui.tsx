import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-morado text-blanco hover:bg-morado-claro',
  secondary: 'bg-noche-2 text-blanco hover:bg-noche-3 border border-noche-3',
  ghost: 'text-niebla hover:text-blanco hover:bg-noche-2',
  danger: 'bg-tajibo/15 text-[#ff9cc0] hover:bg-tajibo/25 border border-tajibo/40',
};

export function buttonClass(variant: Variant = 'primary', extra = '') {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${extra}`;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-noche-3 bg-noche-2/60 p-6 ${className}`}>{children}</div>;
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{children}</h1>
      {actions}
    </div>
  );
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-noche-3 bg-noche px-3 text-blanco placeholder:text-niebla/60 focus:border-morado-claro focus:outline-none aria-invalid:border-tajibo';

export function Field({
  label,
  hint,
  error,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string; error?: string }) {
  const id = props.id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} className={inputClass} {...props} />
      {hint && !error && <p className="text-sm text-niebla">{hint}</p>}
      {error && <p className="text-sm text-[#ff9cc0]">{error}</p>}
    </div>
  );
}

export function Select({
  label,
  children,
  ...props
}: ComponentProps<'select'> & { label: string }) {
  const id = props.id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} className={inputClass} {...props}>
        {children}
      </select>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'sol' | 'tajibo' | 'verde' }) {
  const tones = {
    neutral: 'bg-noche-3 text-niebla',
    sol: 'bg-sol/15 text-sol',
    tajibo: 'bg-tajibo/20 text-[#ff9cc0]',
    verde: 'bg-verde/25 text-[#7be3ad]',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-sol/30 bg-sol/10 px-4 py-3 text-sm text-sol">{children}</p>;
}
