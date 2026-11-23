import { tableToCsv, tableToXlsx } from '@chacota/core/tables';
import { getTranslations } from 'next-intl/server';
import type { NextRequest } from 'next/server';
import { requireOrgResults, resultsFilename } from '@/lib/results';
import { standingsTable } from '@/lib/results-table';

const TYPES = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

export async function GET(request: NextRequest, ctx: RouteContext<'/api/orgs/[slug]/historial/[sessionId]/export'>) {
  const { slug, sessionId } = await ctx.params;
  const { results } = await requireOrgResults(slug, sessionId);

  const params = request.nextUrl.searchParams;
  const format = (params.get('format') ?? 'csv') as keyof typeof TYPES;
  if (!(format in TYPES)) return new Response('Unsupported format', { status: 400 });
  const top = Number(params.get('top')) || undefined;
  const locale = params.get('locale') === 'en' ? 'en' : 'es';
  const t = await getTranslations({ locale, namespace: 'results' });

  const rows = standingsTable(results, locale, (key) => t(key), top);
  const body = format === 'csv' ? tableToCsv(rows) : await tableToXlsx(rows, results.title);
  const filename = resultsFilename(results, top ? `-top${top}` : '', format);
  return new Response(body, {
    headers: {
      'content-type': TYPES[format],
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'private, no-store',
    },
  });
}
