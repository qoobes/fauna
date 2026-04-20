import Anthropic from '@anthropic-ai/sdk';
import type { AiIssue, AiStatus, CrossPageAnalysis, PageMetadata } from '@/types/scan';

let client: Anthropic | null = null;
let lastAuthFailureAt: number | null = null;
const AUTH_COOLDOWN_MS = 5 * 60_000; // Retry after 5 min of auth failures

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export function aiAvailability():
  | { available: true }
  | { available: false; reason: 'no-key' | 'auth-cooling-down' } {
  if (!process.env.ANTHROPIC_API_KEY) return { available: false, reason: 'no-key' };
  if (lastAuthFailureAt && Date.now() - lastAuthFailureAt < AUTH_COOLDOWN_MS) {
    return { available: false, reason: 'auth-cooling-down' };
  }
  return { available: true };
}

const SYSTEM_PROMPT = `You are a senior web accessibility auditor. Your job is to identify HIGH-CONFIDENCE WCAG 2.1 AA issues that require human judgment — things an automated tool (axe-core) cannot catch.

CRITICAL RULES
1. Every finding must cite SPECIFIC evidence: quote the relevant element's text/HTML, describe the exact screenshot region, or reference a CSS selector. Vague claims ("some buttons may be...") are forbidden.
2. Do NOT speculate. If you cannot see clear evidence in the screenshot or HTML, omit the finding. False positives erode trust in the whole audit.
3. Prefer fewer, higher-confidence findings. Cap at 7 per page. If you genuinely see only 2 issues, report 2.
4. Axe-core ran in parallel and will flag: color-contrast ratios, missing alt/labels, ARIA attribute validity, duplicate IDs, heading order, keyboard tab-indexes. Focus on what axe CANNOT see:
   - Alt text quality (present but wrong/unhelpful)
   - Link text ambiguity in context
   - Visual grouping not backed by semantic landmarks
   - Reading order that doesn't match visual flow
   - Cognitive load, unclear error messaging
   - Interactive patterns visible only in the screenshot (custom widgets, motion)
   - Focus order inferable from the DOM
5. Be conservative with severity. "critical" means a user is blocked. "serious" means significant barrier. If unsure, rate lower.`;

const REVIEW_PROMPT = `You are a skeptical reviewer auditing accessibility findings. For each finding below, evaluate:
(a) Evidence check: does the cited element/text actually exist in the HTML? Is the claim verifiable, or speculative?
(b) Axe overlap: would axe-core already catch this? (color-contrast ratios, missing alt attr, invalid ARIA, missing labels, etc.)
(c) Severity calibration: is the rating justified by the evidence? Err toward lower severity.

Return a filtered list. REMOVE findings with weak or absent evidence. DEMOTE severity for findings that are borderline or in axe's territory. KEEP findings that represent genuine human-judgment a11y concerns.

Output format must match input: same JSON schema, just fewer/adjusted findings.`;

interface PerPageResult {
  issues: AiIssue[];
  positiveFindings: string[];
  summary: string;
}

export interface PerPageAnalysisResult {
  result: PerPageResult | null;
  status: AiStatus;
}

export async function runAiPageAnalysis(
  screenshotBase64: string,
  cleanedHtml: string,
  url: string,
  title: string,
): Promise<PerPageAnalysisResult> {
  const avail = aiAvailability();
  if (!avail.available) {
    return {
      result: null,
      status: avail.reason === 'no-key' ? 'no-key' : 'auth-error',
    };
  }
  const c = getClient();
  if (!c) return { result: null, status: 'no-key' };

  try {
    // PASS 1 — generate candidate findings with screenshot + HTML
    const genResp = await callWithRetry(() =>
      c.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: screenshotBase64 },
              },
              {
                type: 'text',
                text: `URL: ${url}
Page title: ${title}

<html_content>
${cleanedHtml}
</html_content>

Return a JSON object:
- "issues": array (max 7) of { "wcagCriterion": "1.4.3" style, "severity": "critical"|"serious"|"moderate"|"minor", "description": string with specific evidence, "element": CSS selector or element description, "remediation": concrete fix }
- "positiveFindings": array of strings (things the page does well)
- "summary": one-paragraph overall assessment

Return ONLY valid JSON, no markdown fences.`,
              },
            ],
          },
        ],
      }),
    );

    const genText =
      genResp.content[0].type === 'text' ? genResp.content[0].text : '';
    const genParsed = parseAiResponse(genText);
    if (!genParsed) return { result: null, status: 'parse-error' };

    // Short-circuit: if pass 1 returned nothing, skip review
    if (genParsed.issues.length === 0) {
      return { result: genParsed, status: 'ok-empty' };
    }

    // PASS 2 — review and filter. Text-only (no image) to save tokens.
    const reviewResp = await callWithRetry(() =>
      c.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3072,
        messages: [
          {
            role: 'user',
            content: `${REVIEW_PROMPT}

<original_html>
${cleanedHtml.slice(0, 15000)}
</original_html>

<findings_to_review>
${JSON.stringify({ issues: genParsed.issues, positiveFindings: genParsed.positiveFindings, summary: genParsed.summary }, null, 2)}
</findings_to_review>

Return the filtered JSON in the same shape. No markdown fences.`,
          },
        ],
      }),
    );

    const reviewText =
      reviewResp.content[0].type === 'text' ? reviewResp.content[0].text : '';
    const reviewed = parseAiResponse(reviewText);
    if (reviewed) {
      return {
        result: reviewed,
        status: reviewed.issues.length === 0 ? 'ok-empty' : 'ok',
      };
    }
    // Review pass parse failure: fall back to pass 1 output (better than nothing)
    return { result: genParsed, status: 'ok' };
  } catch (err) {
    return { result: null, status: classifyError(err) };
  }
}

export async function runAiCrossPageAnalysis(
  pages: Array<{ url: string; metadata: PageMetadata }>,
): Promise<CrossPageAnalysis | null> {
  const avail = aiAvailability();
  if (!avail.available) return null;
  const c = getClient();
  if (!c) return null;

  const siteStructure = pages.map((p) => ({
    url: p.url,
    title: p.metadata.title,
    headings: p.metadata.headings,
    landmarks: p.metadata.landmarks,
    navLinks: p.metadata.navLinks.slice(0, 30),
    lang: p.metadata.lang,
    hasSkipLink: p.metadata.hasSkipLink,
  }));

  let structureJson = JSON.stringify(siteStructure, null, 2);
  if (structureJson.length > 50000) {
    const compact = pages.map((p) => ({
      url: p.url,
      title: p.metadata.title,
      headings: p.metadata.headings.map((h) => ({ level: h.level, text: h.text.slice(0, 60) })),
      landmarks: p.metadata.landmarks,
      navLinks: p.metadata.navLinks.slice(0, 15).map((n) => ({ text: n.text.slice(0, 40), href: n.href })),
      lang: p.metadata.lang,
      hasSkipLink: p.metadata.hasSkipLink,
    }));
    structureJson = JSON.stringify(compact, null, 2);
  }

  try {
    const response = await callWithRetry(() =>
      c.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Analyse site structure data from ${pages.length} pages for cross-page accessibility issues.

Check for:
1. Navigation consistency (WCAG 3.2.3)
2. Consistent identification (WCAG 3.2.4)
3. Heading hierarchy per page
4. Landmark consistency
5. Language consistency
6. Skip navigation presence
7. Page title patterns

Only flag HIGH-CONFIDENCE cross-page inconsistencies with specific cited pages. Do not speculate.

<site_structure>
${structureJson}
</site_structure>

Return JSON with:
- "consistencyScore": 0-100
- "issues": array of { "wcagCriterion", "severity", "description", "affectedPages": string[], "remediation" }
- "summary": brief overall assessment

Return ONLY valid JSON, no markdown fences.`,
          },
        ],
      }),
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return parseCrossPageResponse(text);
  } catch (err) {
    classifyError(err); // updates lastAuthFailureAt if 401/403
    return null;
  }
}

function classifyError(err: unknown): AiStatus {
  const status = (err as { status?: number })?.status;
  const message = (err as { message?: string })?.message ?? String(err);

  if (status === 401 || status === 403) {
    lastAuthFailureAt = Date.now();
    console.warn(`[AI] Auth error (${status}); AI will cool down for ${AUTH_COOLDOWN_MS / 1000}s`);
    return 'auth-error';
  }

  const shortMessage = message.split('\n')[0].slice(0, 200);
  console.warn(`[AI] API error${status ? ` (${status})` : ''}: ${shortMessage}`);
  return 'api-error';
}

function parseAiResponse(text: string): PerPageResult | null {
  try {
    const cleaned = stripFences(text);
    const parsed = JSON.parse(cleaned);
    return {
      issues: (parsed.issues ?? []).map((i: Record<string, unknown>) => ({
        wcagCriterion: String(i.wcagCriterion ?? ''),
        severity: validateSeverity(i.severity),
        description: String(i.description ?? ''),
        element: String(i.element ?? ''),
        remediation: String(i.remediation ?? ''),
      })),
      positiveFindings: (parsed.positiveFindings ?? []).map(String),
      summary: String(parsed.summary ?? ''),
    };
  } catch {
    return null;
  }
}

function parseCrossPageResponse(text: string): CrossPageAnalysis | null {
  try {
    const cleaned = stripFences(text);
    const parsed = JSON.parse(cleaned);
    return {
      consistencyScore: Math.max(0, Math.min(100, Number(parsed.consistencyScore) || 0)),
      issues: (parsed.issues ?? []).map((i: Record<string, unknown>) => ({
        wcagCriterion: String(i.wcagCriterion ?? ''),
        severity: validateSeverity(i.severity),
        description: String(i.description ?? ''),
        affectedPages: ((i.affectedPages as unknown[]) ?? []).map(String),
        remediation: String(i.remediation ?? ''),
      })),
      summary: String(parsed.summary ?? ''),
    };
  } catch {
    return null;
  }
}

function stripFences(text: string): string {
  return text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
}

function validateSeverity(s: unknown): AiIssue['severity'] {
  const valid = ['critical', 'serious', 'moderate', 'minor'];
  return valid.includes(String(s)) ? (String(s) as AiIssue['severity']) : 'moderate';
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) throw err; // do not retry auth errors
      if (status === 429 || status === 500 || status === 503) {
        const delay = Math.pow(2, i + 1) * 1000;
        console.warn(`[AI] transient ${status}; retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
