import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { scanManager } from '@/lib/scanner/scanManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Prefer in-memory state for running scans (fresher pages[])
  const live = scanManager.getScan(id);
  if (live && (live.status === 'running' || live.status === 'queued')) {
    return Response.json(live.result);
  }

  const [row] = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  if (row.result) {
    return Response.json(row.result);
  }

  return Response.json({
    scanId: row.id,
    url: row.url,
    status: row.status,
    config: row.config,
    startedAt: row.startedAt?.toISOString() ?? row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    overallScore: row.overallScore,
    totalPages: row.totalPages,
    totalIssues: row.totalIssues,
    pages: [],
    errorMessage: row.errorMessage,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (row.ownerId !== session.user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (row.status !== 'running' && row.status !== 'queued') {
    return Response.json({ error: 'Scan is not active' }, { status: 409 });
  }

  await scanManager.cancel(id);
  return Response.json({ scanId: id, status: 'cancelled' });
}
