import { readFile, stat } from 'node:fs/promises';
import { auth } from '@/auth';
import { screenshotPath } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; filename: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id, filename } = await params;

  // Tight validation: UUID-ish for id, hex-only for filename
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) {
    return new Response('Invalid scan id', { status: 400 });
  }
  if (!/^[a-f0-9]+\.(png|jpeg|jpg)$/.test(filename)) {
    return new Response('Invalid filename', { status: 400 });
  }

  const filePath = screenshotPath(id, filename);
  try {
    await stat(filePath);
    const buf = await readFile(filePath);
    const ext = filename.endsWith('.png') ? 'png' : 'jpeg';
    return new Response(buf as BodyInit, {
      headers: {
        'Content-Type': `image/${ext}`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
