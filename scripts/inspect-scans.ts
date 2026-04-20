// Dump recent scans to understand scoring and AI behavior.
import 'dotenv/config';
import { db } from '@/lib/db/client';
import { scans } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

const rows = await db
  .select()
  .from(scans)
  .orderBy(desc(scans.createdAt))
  .limit(8);

for (const s of rows) {
  console.log('='.repeat(80));
  console.log(`Scan ${s.id}`);
  console.log(`  URL: ${s.url}`);
  console.log(`  Owner: ${s.ownerEmail}`);
  console.log(`  Status: ${s.status}  Score: ${s.overallScore}  Pages: ${s.totalPages}  Issues: ${s.totalIssues}`);
  console.log(`  Created: ${s.createdAt?.toISOString()}`);
  if (s.errorMessage) console.log(`  Error: ${s.errorMessage}`);
  if (s.result) {
    const r = s.result as import('@/types/scan').ScanResult;
    for (const p of r.pages.slice(0, 5)) {
      const axeBySev: Record<string, number> = {};
      for (const v of p.axeViolations) axeBySev[v.impact] = (axeBySev[v.impact] ?? 0) + 1;
      const aiBySev: Record<string, number> = {};
      for (const ai of (p.aiIssues ?? [])) aiBySev[ai.severity] = (aiBySev[ai.severity] ?? 0) + 1;
      console.log(`  - [${p.status}] score=${p.score} ${p.url}`);
      console.log(`      axe: ${p.axeViolations.length} ${JSON.stringify(axeBySev)}`);
      if (p.aiIssues === null) {
        console.log(`      ai: null (disabled or failed)`);
      } else {
        console.log(`      ai: ${p.aiIssues.length} ${JSON.stringify(aiBySev)}`);
        for (const ai of p.aiIssues.slice(0, 2)) {
          console.log(`         [${ai.severity}] WCAG ${ai.wcagCriterion}: ${ai.description.slice(0, 120)}`);
        }
      }
    }
    if (r.crossPageAnalysis) {
      console.log(`  Cross-page: consistency=${r.crossPageAnalysis.consistencyScore} issues=${r.crossPageAnalysis.issues.length}`);
    } else {
      console.log(`  Cross-page: none`);
    }
  }
}
process.exit(0);
