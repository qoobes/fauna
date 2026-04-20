import { computePageScore } from '@/lib/scanner/scorer';
import type { AxeViolation, AiIssue } from '@/types/scan';

function axe(sev: AxeViolation['impact'], count: number): AxeViolation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `rule-${sev}-${i}`,
    impact: sev,
    description: 'test',
    helpUrl: '',
    wcagTags: [],
    nodes: [],
  }));
}

function ai(sev: AiIssue['severity'], count: number): AiIssue[] {
  return Array.from({ length: count }, () => ({
    wcagCriterion: '99.9.9',
    severity: sev,
    description: 'test',
    element: '',
    remediation: '',
  }));
}

const cases: Array<[string, AxeViolation[], AiIssue[] | null]> = [
  ['Clean page', [], []],
  ['1 critical axe', axe('critical', 1), []],
  ['1 serious axe', axe('serious', 1), []],
  ['5 critical axe', axe('critical', 5), []],
  ['10 minor axe', axe('minor', 10), []],
  ['Mixed (1c/2s/2m/1min)', [...axe('critical', 1), ...axe('serious', 2), ...axe('moderate', 2), ...axe('minor', 1)], []],
  ['Liverpool-ish (15 AI issues)', [], [...ai('critical', 0), ...ai('serious', 6), ...ai('moderate', 6), ...ai('minor', 3)]],
  ['Liverpool-ish (20 AI mixed)', [], [...ai('critical', 1), ...ai('serious', 9), ...ai('moderate', 9), ...ai('minor', 1)]],
  ['Catastrophic (50 axe + 20 AI)', [...axe('critical', 10), ...axe('serious', 10), ...axe('moderate', 15), ...axe('minor', 15)], [...ai('serious', 10), ...ai('moderate', 10)]],
];

for (const [label, a, i] of cases) {
  console.log(`${label.padEnd(35)} → score ${computePageScore(a, i).toString().padStart(3, ' ')}`);
}
process.exit(0);
