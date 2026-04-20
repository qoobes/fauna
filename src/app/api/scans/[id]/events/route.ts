import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { scanManager } from '@/lib/scanner/scanManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const live = scanManager.getScan(id);

  // Historical scan (not in memory) — send a single completion event and close.
  if (!live) {
    const [row] = await db
      .select({ id: scans.id, status: scans.status })
      .from(scans)
      .where(eq(scans.id, id))
      .limit(1);
    if (!row) return new Response('Not found', { status: 404 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: historical\ndata: ${JSON.stringify({ status: row.status })}\n\n`),
        );
        controller.close();
      },
    });
    return new Response(stream, { headers: sseHeaders() });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    // CRITICAL: this must be synchronous. Any await here would buffer the entire stream.
    start(controller) {
      let closed = false;

      const send = (eventId: number, payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`id: ${eventId}\ndata: ${payload}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Replay buffered events synchronously
      scanManager.getEventBuffer(id).forEach((ev, i) => send(i, JSON.stringify(ev)));

      // Subscribe to future events
      const unsubscribe = scanManager.subscribe(id, (eventId, event) => {
        send(eventId, JSON.stringify(event));
      });

      // Keep-alive comment
      const keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          closed = true;
        }
      }, 25_000);

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
