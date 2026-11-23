'use client';

import { Link, usePathname } from '@/i18n/navigation';

/** Activities · History · Organization, with the current section highlighted. */
export function OrgNav({
  base,
  organizationHref,
  labels,
}: {
  base: string;
  organizationHref: string;
  labels: { activities: string; history: string; organization: string };
}) {
  const pathname = usePathname();
  const section = pathname.startsWith(`${base}/historial`) ? 'history' : pathname.startsWith(`${base}/admin`) ? 'organization' : 'activities';
  const item = (key: typeof section, href: string, children: React.ReactNode) => (
    <Link
      href={href}
      aria-current={section === key ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold transition-colors ${
        section === key ? 'bg-morado text-blanco' : 'text-niebla hover:bg-noche-3 hover:text-blanco'
      }`}
    >
      {children}
    </Link>
  );
  return (
    <nav className="flex flex-wrap gap-1 rounded-2xl bg-noche-2 p-1.5" aria-label={labels.organization}>
      {item('activities', base, labels.activities)}
      {item('history', `${base}/historial`, labels.history)}
      {item(
        'organization',
        organizationHref,
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
          </svg>
          {labels.organization}
        </>,
      )}
    </nav>
  );
}
