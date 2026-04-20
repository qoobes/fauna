import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { AxeViolation } from '@/types/scan';

export async function runAxeAnalysis(page: Page): Promise<AxeViolation[]> {
  try {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    return results.violations.map(v => ({
      id: v.id,
      impact: (v.impact as AxeViolation['impact']) ?? 'minor',
      description: v.description,
      helpUrl: v.helpUrl,
      wcagTags: v.tags.filter(t => t.startsWith('wcag')),
      nodes: v.nodes.map(n => ({
        html: n.html,
        target: n.target.map(String),
        failureSummary: n.failureSummary ?? '',
      })),
    }));
  } catch (err) {
    console.error('[axe] analysis failed:', err);
    return [];
  }
}
