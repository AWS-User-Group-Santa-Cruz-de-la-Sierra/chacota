import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Old organization URLs from before activities were separated from administration.
const MOVED: [string, string][] = [
  ['/app/orgs/:slug/tiluchis/:id', '/app/orgs/:slug/tiluchi/:id'],
  ['/app/orgs/:slug/results/:path*', '/app/orgs/:slug/historial/:path*'],
  ['/app/orgs/:slug/settings', '/app/orgs/:slug/admin'],
  ['/app/orgs/:slug/members', '/app/orgs/:slug/admin/miembros'],
];

const nextConfig: NextConfig = {
  async redirects() {
    return MOVED.flatMap(([source, destination]) => [
      { source, destination, permanent: true },
      { source: `/en${source}`, destination: `/en${destination}`, permanent: true },
    ]);
  },
  experimental: { authInterrupts: true },
  transpilePackages: ['@chacota/core', '@chacota/db', '@chacota/live', '@chacota/tiluchi', '@chacota/embolsau'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withNextIntl(nextConfig);
