import Image from 'next/image';

/** Dañinera, the Chacota mascot. Decorative unless a `label` is given. */
export function ChacotaMark({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <Image
      src="/brand/daninera.png"
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className="shrink-0 object-contain"
    />
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ChacotaMark size={size} />
      <span className="font-display font-extrabold tracking-tight" style={{ fontSize: size * 0.8 }}>
        chacota
      </span>
    </span>
  );
}
