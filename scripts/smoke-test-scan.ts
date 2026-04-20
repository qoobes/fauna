// Smoke test: inserts a test user, creates a JWT session cookie, hits the API end-to-end.
// Usage: bun scripts/smoke-test-scan.ts
import 'dotenv/config';
import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const TEST_EMAIL = 'smoketest@liverpool.ac.uk';
const BASE = 'http://localhost:3000';

async function main() {
  // Upsert test user
  const existing = await db.select().from(users).where(eq(users.email, TEST_EMAIL)).limit(1);
  const userId = existing[0]?.id ?? crypto.randomUUID();
  if (existing.length === 0) {
    await db.insert(users).values({
      id: userId,
      email: TEST_EMAIL,
      emailVerified: new Date(),
      createdAt: new Date(),
    });
    console.log(`[smoke] created test user ${userId}`);
  } else {
    console.log(`[smoke] using existing user ${userId}`);
  }

  // Manufacture a JWT session token matching what Auth.js would issue
  const secret = process.env.AUTH_SECRET!;
  const token = await encode({
    token: { id: userId, email: TEST_EMAIL, sub: userId },
    secret,
    salt: 'authjs.session-token',
  });

  const cookie = `authjs.session-token=${token}`;
  console.log('[smoke] cookie ready');

  // Create a scan
  console.log('\n[smoke] POST /api/scans');
  const createRes = await fetch(`${BASE}/api/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ url: 'https://example.com', maxDepth: 0, pageLimit: 1 }),
  });
  const createText = await createRes.text();
  console.log(`  status=${createRes.status} body=${createText.slice(0, 200)}`);

  if (!createRes.ok) process.exit(1);
  const { scanId } = JSON.parse(createText);
  console.log(`  scanId=${scanId}`);

  // Poll via GET /api/scans/:id until complete
  console.log('\n[smoke] polling GET /api/scans/' + scanId);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(`${BASE}/api/scans/${scanId}`, { headers: { cookie } });
    const data = (await r.json()) as { status?: string; overallScore?: number; totalPages?: number; pages?: unknown[] };
    console.log(
      `  t=${i * 2}s status=${data.status} pages=${data.pages?.length ?? 0} score=${data.overallScore ?? '-'}`,
    );
    if (data.status === 'complete' || data.status === 'error' || data.status === 'cancelled') {
      console.log('\n[smoke] Final:', JSON.stringify({
        status: data.status,
        score: data.overallScore,
        pages: data.pages?.length,
      }, null, 2));
      process.exit(0);
    }
  }

  console.log('[smoke] timeout waiting for scan');
  process.exit(1);
}

main().catch((err) => {
  console.error('[smoke] fatal:', err);
  process.exit(1);
});
