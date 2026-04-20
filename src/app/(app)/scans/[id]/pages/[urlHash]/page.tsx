import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { scanManager } from '@/lib/scanner/scanManager';
import { PageDetail } from '@/components/scan/PageDetail';
import { urlToHash } from '@/lib/scanner/urlUtils';

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ id: string; urlHash: string }>;
}) {
  const { id, urlHash } = await params;

  let result: import('@/types/scan').ScanResult | null = null;

  const live = scanManager.getScan(id);
  if (live) {
    result = live.result;
  } else {
    const [row] = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
    if (!row) notFound();
    result = row.result;
  }

  if (!result) notFound();

  const page = result.pages.find((p) => urlToHash(p.url) === urlHash);
  if (!page) notFound();

  return (
    <div className="app-shell" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <PageDetail page={page} scanId={id} />
    </div>
  );
}
