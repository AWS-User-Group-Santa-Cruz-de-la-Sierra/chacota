'use client';

import { Link, usePathname } from '@/i18n/navigation';

export function AdminNav({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  // The longest matching href wins, so "General" is not active on its sub-pages.
  const active = items.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label={label} className="flex w-full flex-col gap-1 sm:w-56">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item === active ? 'page' : undefined}
          className={`flex min-h-11 items-center rounded-xl px-4 font-semibold transition-colors ${
            item === active ? 'bg-noche-2 text-blanco' : 'text-niebla hover:bg-noche-2 hover:text-blanco'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
