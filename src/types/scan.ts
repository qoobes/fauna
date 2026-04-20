export interface ScanConfig {
  url: string;
  maxDepth: number;
  pageLimit: number;
  cookies?: CookieParam[];
  localStorage?: Record<string, string>;
}

export interface CookieParam {
  name: string;
  value: string;
  domain: string;
  path?: string;
}

export type ScanStatus = 'queued' | 'running' | 'complete' | 'error' | 'cancelled';

export interface ScanResult {
  scanId: string;
  url: string;
  status: ScanStatus;
  config: ScanConfig;
  startedAt: string;
  completedAt?: string;
  overallScore: number;
  totalPages: number;
  totalIssues: number;
  pages: PageResult[];
  crossPageAnalysis?: CrossPageAnalysis;
}

export interface ScanListItem {
  id: string;
  url: string;
  status: ScanStatus;
  overallScore: number;
  totalPages: number;
  totalIssues: number;
  criticalCount: number;
  ownerEmail: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export type PageStatus = 'success' | 'error' | 'skipped';

export type AiStatus =
  | 'ok'                  // AI ran and returned findings
  | 'ok-empty'            // AI ran and found nothing
  | 'no-key'              // ANTHROPIC_API_KEY not set
  | 'auth-error'          // API returned 401/403
  | 'api-error'           // Other API error (timeout, 500, etc.)
  | 'parse-error'         // AI returned malformed JSON
  | 'skipped';            // Page was skipped before analysis ran

export interface PageResult {
  url: string;
  status: PageStatus;
  score: number;
  screenshotFilename: string;
  error?: string;
  axeViolations: AxeViolation[];
  aiIssues: AiIssue[] | null;
  aiPositiveFindings: string[] | null;
  aiSummary: string | null;
  aiStatus: AiStatus;
  metadata: PageMetadata;
}

export interface AxeViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  helpUrl: string;
  wcagTags: string[];
  nodes: AxeNode[];
}

export interface AxeNode {
  html: string;
  target: string[];
  failureSummary: string;
}

export interface AiIssue {
  wcagCriterion: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  element: string;
  remediation: string;
}

export interface CrossPageAnalysis {
  consistencyScore: number;
  issues: CrossPageIssue[];
  summary: string;
}

export interface CrossPageIssue {
  wcagCriterion: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  affectedPages: string[];
  remediation: string;
}

export interface PageMetadata {
  title: string;
  headings: HeadingInfo[];
  landmarks: LandmarkInfo[];
  navLinks: NavLinkInfo[];
  lang: string;
  hasSkipLink: boolean;
}

export interface HeadingInfo {
  level: number;
  text: string;
}

export interface LandmarkInfo {
  tag: string;
  role: string;
  label: string;
}

export interface NavLinkInfo {
  text: string;
  href: string;
}

export type SSEEvent =
  | { type: 'scan-queued'; position: number }
  | { type: 'scan-started'; scanId: string; url: string; maxDepth: number; pageLimit: number }
  | { type: 'page-started'; url: string; pageIndex: number; totalDiscovered: number }
  | { type: 'page-complete'; url: string; pageIndex: number; score: number; issueCount: number; criticalCount: number; status: 'success' }
  | { type: 'page-error'; url: string; pageIndex: number; error: string; status: 'error' }
  | { type: 'page-skipped'; url: string; pageIndex: number; reason: string; status: 'skipped' }
  | { type: 'cross-page-started'; pageCount: number }
  | { type: 'cross-page-complete'; consistencyScore: number; issueCount: number }
  | { type: 'scan-complete'; scanId: string; overallScore: number; totalPages: number; totalIssues: number; duration: number }
  | { type: 'scan-error'; scanId: string; error: string };
