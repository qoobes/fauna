import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { scanManager } from '@/lib/scanner/scanManager';
import { ensureCrawlerRegistered } from '@/lib/scanner/crawler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Make sure the crawler module has been imported (wires the runner).
ensureCrawlerRegistered();

const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string().optional(),
});

const bodySchema = z.object({
  url: z.string().url(),
  maxDepth: z.number().int().min(0).max(5).default(1),
  pageLimit: z.number().int().min(1).max(50).default(10),
  cookies: z.array(cookieSchema).optional(),
  localStorage: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const scanId = crypto.randomUUID();
  const config = parsed.data;

  try {
    await db.insert(scans).values({
      id: scanId,
      ownerId: session.user.id,
      ownerEmail: session.user.email,
      url: config.url,
      status: 'queued',
      config,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[api/scans POST] insert failed:', err);
    return Response.json({ error: 'Failed to create scan' }, { status: 500 });
  }

  await scanManager.enqueue(scanId, config, {
    id: session.user.id,
    email: session.user.email,
  });

  return Response.json({ scanId }, { status: 201 });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const mine = url.searchParams.get('owner') === 'me';
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));

  try {
    const rows = await db
      .select({
        id: scans.id,
        url: scans.url,
        status: scans.status,
        overallScore: scans.overallScore,
        totalPages: scans.totalPages,
        totalIssues: scans.totalIssues,
        criticalCount: scans.criticalCount,
        ownerId: scans.ownerId,
        ownerEmail: scans.ownerEmail,
        createdAt: scans.createdAt,
        startedAt: scans.startedAt,
        completedAt: scans.completedAt,
        errorMessage: scans.errorMessage,
      })
      .from(scans)
      .where(mine ? eq(scans.ownerId, session.user.id) : undefined)
      .orderBy(desc(scans.createdAt))
      .limit(limit);

    return Response.json({
      scans: rows.map((r) => ({
        id: r.id,
        url: r.url,
        status: r.status,
        overallScore: r.overallScore,
        totalPages: r.totalPages,
        totalIssues: r.totalIssues,
        criticalCount: r.criticalCount,
        ownerEmail: r.ownerEmail,
        createdAt: r.createdAt?.toISOString() ?? null,
        startedAt: r.startedAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        errorMessage: r.errorMessage,
      })),
    });
  } catch (err) {
    console.error('[api/scans GET] failed:', err);
    return Response.json({ error: 'Failed to list scans' }, { status: 500 });
  }
}
