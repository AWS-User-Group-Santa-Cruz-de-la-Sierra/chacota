import { exportChacotaJson, exportCsv, exportXlsx } from '@chacota/tiluchi/exporters';
import { getTiluchi } from '@chacota/tiluchi/content';
import { notFound } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { requireOrgAccess } from '@/lib/auth';
import { getDb } from '@/lib/db';

const TYPES = {
  json: 'application/json',
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

export async function GET(request: NextRequest, ctx: RouteContext<'/api/orgs/[slug]/tiluchis/[id]/export'>) {
  const { slug, id } = await ctx.params;
  const { org } = await requireOrgAccess(slug);
  const tiluchi = await getTiluchi(getDb(), org.id, id);
  if (!tiluchi) notFound();

  const format = (request.nextUrl.searchParams.get('format') ?? 'json') as keyof typeof TYPES;
  if (!(format in TYPES)) return new Response('Unsupported format', { status: 400 });

  const body =
    format === 'json'
      ? exportChacotaJson(tiluchi)
      : format === 'csv'
        ? exportCsv(tiluchi, tiluchi.language)
        : await exportXlsx(tiluchi, tiluchi.language);
  const filename = `${tiluchi.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'tiluchi'}.${format}`;
  return new Response(body, {
    headers: {
      'content-type': TYPES[format],
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
