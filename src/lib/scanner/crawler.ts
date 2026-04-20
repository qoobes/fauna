import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { scanManager } from './scanManager';
import { normalizeUrl, isSameOrigin, urlToHash } from './urlUtils';
import { runAxeAnalysis } from './axeAnalyzer';
import { runAiPageAnalysis, runAiCrossPageAnalysis, aiAvailability } from './aiAnalyzer';
import { adjustAiConfidence, computePageScore, computeOverallScore } from './scorer';
import { saveScreenshot, saveRawResult, saveScanJson, ensureScanDir } from '@/lib/storage';
import type { ScanConfig, PageResult, PageMetadata, CrossPageAnalysis } from '@/types/scan';

interface CrawlJob {
  url: string;
  depth: number;
}

async function runCrawl(scanId: string) {
  const state = scanManager.getScan(scanId);
  if (!state) return;

  const { config } = state;
  const signal = state.abortController.signal;
  const startTime = Date.now();

  await ensureScanDir(scanId);

  scanManager.emit(scanId, {
    type: 'scan-started',
    scanId,
    url: config.url,
    maxDepth: config.maxDepth,
    pageLimit: config.pageLimit,
  });

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await createContext(browser, config);
    const page = await context.newPage();

    const seedUrl = normalizeUrl(config.url, config.url);
    if (!seedUrl) {
      throw new Error(`Invalid seed URL: ${config.url}`);
    }

    const queue: CrawlJob[] = [{ url: seedUrl, depth: 0 }];
    const visited = new Set<string>([seedUrl]);
    // The "effective" seed URL we use for same-origin checks. Updated after the
    // first page navigation so we follow redirects (e.g. liverpool.ac.uk → www.liverpool.ac.uk).
    let effectiveSeedUrl = seedUrl;
    let isFirstPage = true;

    while (queue.length > 0 && state.result.pages.length < config.pageLimit && !signal.aborted) {
      const job = queue.shift()!;
      const pageIndex = state.result.pages.length;
      const totalDiscovered = visited.size;

      scanManager.emit(scanId, {
        type: 'page-started',
        url: job.url,
        pageIndex,
        totalDiscovered,
      });

      const pageResult = await processPage(page, job.url, scanId);
      scanManager.pushPageResult(scanId, pageResult);

      // After the first page navigation, capture the resolved URL (in case of redirect)
      // so all subsequent same-origin checks use the canonical host the site actually serves on.
      if (isFirstPage && pageResult.status === 'success') {
        isFirstPage = false;
        const finalUrl = page.url();
        const finalNormalized = normalizeUrl(finalUrl, finalUrl);
        if (finalNormalized && finalNormalized !== seedUrl) {
          effectiveSeedUrl = finalNormalized;
          visited.add(finalNormalized);
        }
      }

      if (pageResult.status === 'success') {
        scanManager.emit(scanId, {
          type: 'page-complete',
          url: job.url,
          pageIndex,
          score: pageResult.score,
          issueCount: pageResult.axeViolations.length + (pageResult.aiIssues?.length ?? 0),
          criticalCount: pageResult.axeViolations.filter((v) => v.impact === 'critical').length,
          status: 'success',
        });
      } else if (pageResult.status === 'error') {
        scanManager.emit(scanId, {
          type: 'page-error',
          url: job.url,
          pageIndex,
          error: pageResult.error ?? 'Unknown error',
          status: 'error',
        });
      } else {
        scanManager.emit(scanId, {
          type: 'page-skipped',
          url: job.url,
          pageIndex,
          reason: pageResult.error ?? 'Non-HTML content',
          status: 'skipped',
        });
      }

      await scanManager.persistProgress(scanId);

      if (job.depth < config.maxDepth && pageResult.status === 'success') {
        const links = await extractLinks(page);
        let queuedFromThisPage = 0;
        for (const link of links) {
          const normalized = normalizeUrl(link, job.url);
          if (normalized && isSameOrigin(normalized, effectiveSeedUrl) && !visited.has(normalized)) {
            visited.add(normalized);
            queue.push({ url: normalized, depth: job.depth + 1 });
            queuedFromThisPage++;
          }
        }
        console.log(
          `[crawler] ${job.url} discovered ${links.length} links, ${queuedFromThisPage} queued (depth ${job.depth + 1}). Visited: ${visited.size}, queue: ${queue.length}`,
        );
      }
    }

    // Cross-page analysis
    let crossPageAnalysis: CrossPageAnalysis | undefined;
    const successPages = state.result.pages.filter((p) => p.status === 'success');

    if (successPages.length >= 2 && !signal.aborted && aiAvailability().available) {
      scanManager.emit(scanId, {
        type: 'cross-page-started',
        pageCount: successPages.length,
      });

      const cpResult = await runAiCrossPageAnalysis(
        successPages.map((p) => ({ url: p.url, metadata: p.metadata })),
      );
      crossPageAnalysis = cpResult ?? undefined;

      if (crossPageAnalysis) {
        scanManager.emit(scanId, {
          type: 'cross-page-complete',
          consistencyScore: crossPageAnalysis.consistencyScore,
          issueCount: crossPageAnalysis.issues.length,
        });
      }
    }

    const totalIssues =
      state.result.pages.reduce(
        (sum, p) => sum + p.axeViolations.length + (p.aiIssues?.length ?? 0),
        0,
      ) + (crossPageAnalysis?.issues.length ?? 0);

    const pageScores = successPages.map((p) => p.score);
    const overallScore = computeOverallScore(
      pageScores,
      crossPageAnalysis?.consistencyScore ?? null,
    );

    const finalStatus = signal.aborted ? 'cancelled' : 'complete';

    await scanManager.finalize(scanId, {
      status: finalStatus,
      overallScore,
      totalIssues,
      totalPages: state.result.pages.length,
      pages: state.result.pages,
      crossPageAnalysis,
      completedAt: new Date().toISOString(),
    });

    // Also save a JSON snapshot to disk for debugging
    await saveScanJson(scanId, state.result).catch(() => {});

    scanManager.emit(scanId, {
      type: 'scan-complete',
      scanId,
      overallScore,
      totalPages: state.result.pages.length,
      totalIssues,
      duration: Date.now() - startTime,
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function createContext(browser: Browser, config: ScanConfig): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'FAUNA Accessibility Analyser/2.0',
  });

  if (config.cookies?.length) {
    await context.addCookies(
      config.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
      })),
    );
  }

  if (config.localStorage && Object.keys(config.localStorage).length > 0) {
    const origin = new URL(config.url).origin;
    await context.addInitScript((storage: Record<string, string>) => {
      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, value);
      }
    }, config.localStorage);
    const tempPage = await context.newPage();
    await tempPage.goto(origin, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});
    await tempPage.close();
  }

  return context;
}

async function processPage(page: Page, url: string, scanId: string): Promise<PageResult> {
  const hash = urlToHash(url);
  const emptyMetadata: PageMetadata = {
    title: '',
    headings: [],
    landmarks: [],
    navLinks: [],
    lang: '',
    hasSkipLink: false,
  };

  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    const contentType = response?.headers()['content-type'] ?? '';
    if (!contentType.includes('text/html')) {
      return {
        url,
        status: 'skipped',
        score: 0,
        screenshotFilename: '',
        error: `Non-HTML content: ${contentType}`,
        axeViolations: [],
        aiIssues: null,
        aiPositiveFindings: null,
        aiSummary: null,
        aiStatus: 'skipped',
        metadata: emptyMetadata,
      };
    }

    await waitForDomStable(page);
    // Nudge the page by scrolling so lazy-loaded content has a chance to hydrate
    // before axe analyzes. Then scroll back to top so screenshots start at the fold.
    await nudgeScroll(page);
    const cleanedHtml = await cleanHtmlInBrowser(page);
    const metadata = await extractMetadata(page);

    const screenshotFilename = `${hash}.jpeg`;
    const fullPageBuffer = await captureFullPageBounded(page);
    await saveScreenshot(scanId, screenshotFilename, fullPageBuffer);

    const ai = aiAvailability();
    let aiScreenshotBase64: string | null = null;
    if (ai.available) {
      const viewportBuffer = await page.screenshot({
        fullPage: false,
        type: 'jpeg',
        quality: 80,
        scale: 'css',
      });
      aiScreenshotBase64 = viewportBuffer.toString('base64');
    }

    const [axeViolations, aiResponse] = await Promise.all([
      runAxeAnalysis(page),
      aiScreenshotBase64
        ? runAiPageAnalysis(aiScreenshotBase64, cleanedHtml, url, metadata.title)
        : Promise.resolve({
            result: null,
            status: (!ai.available && ai.reason === 'no-key' ? 'no-key' : 'auth-error') as import('@/types/scan').AiStatus,
          }),
    ]);

    await saveRawResult(scanId, hash, 'axe', axeViolations).catch(() => {});
    if (aiResponse.result) {
      await saveRawResult(scanId, hash, 'ai', aiResponse.result).catch(() => {});
    }

    // Apply AI confidence adjustment (demote severity for axe-coverable WCAG criteria)
    const rawAiIssues = aiResponse.result?.issues ?? null;
    const aiIssues = rawAiIssues ? adjustAiConfidence(rawAiIssues) : null;
    const score = computePageScore(axeViolations, aiIssues);

    return {
      url,
      status: 'success',
      score,
      screenshotFilename,
      axeViolations,
      aiIssues,
      aiPositiveFindings: aiResponse.result?.positiveFindings ?? null,
      aiSummary: aiResponse.result?.summary ?? null,
      aiStatus: aiResponse.status,
      metadata,
    };
  } catch (err) {
    return {
      url,
      status: 'error',
      score: 0,
      screenshotFilename: '',
      error: err instanceof Error ? err.message : String(err),
      axeViolations: [],
      aiIssues: null,
      aiPositiveFindings: null,
      aiSummary: null,
      aiStatus: 'skipped',
      metadata: emptyMetadata,
    };
  }
}

async function nudgeScroll(page: Page) {
  // Scroll top-to-bottom then back, triggering lazy-loaded content / IntersectionObservers
  // that many modern sites use for images, cards, and deferred content.
  await page
    .evaluate(async () => {
      const scrollHeight = () =>
        Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
      const step = Math.max(400, window.innerHeight);
      for (let y = 0; y < scrollHeight(); y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 150));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 200));
    })
    .catch(() => {});
}

const MAX_FULLPAGE_HEIGHT = 8000;

async function captureFullPageBounded(page: Page): Promise<Buffer> {
  const dims = await page
    .evaluate(() => ({
      width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
    }))
    .catch(() => ({ width: 1280, height: 720 }));

  if (dims.height > MAX_FULLPAGE_HEIGHT) {
    return page.screenshot({
      type: 'jpeg',
      quality: 75,
      scale: 'css',
      clip: { x: 0, y: 0, width: Math.min(dims.width, 1920), height: MAX_FULLPAGE_HEIGHT },
    });
  }

  return page.screenshot({
    fullPage: true,
    type: 'jpeg',
    quality: 75,
    scale: 'css',
  });
}

async function waitForDomStable(page: Page) {
  try {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let timeout: ReturnType<typeof setTimeout>;
        const maxWait = setTimeout(resolve, 3000);
        const observer = new MutationObserver(() => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            observer.disconnect();
            clearTimeout(maxWait);
            resolve();
          }, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        timeout = setTimeout(() => {
          observer.disconnect();
          clearTimeout(maxWait);
          resolve();
        }, 500);
      });
    });
  } catch {
    await page.waitForTimeout(2000);
  }
}

async function cleanHtmlInBrowser(page: Page): Promise<string> {
  const html = await page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript, svg, iframe').forEach((el) => el.remove());
    clone.querySelectorAll('*').forEach((el) => {
      const attrs = [...el.attributes];
      for (const attr of attrs) {
        if (attr.name.startsWith('data-') || attr.name === 'style') {
          el.removeAttribute(attr.name);
        }
      }
    });
    return clone.outerHTML;
  });

  if (html.length <= 30000) return html;
  const truncated = html.slice(0, 30000);
  const lastClose = truncated.lastIndexOf('>');
  return lastClose > 0 ? truncated.slice(0, lastClose + 1) : truncated;
}

async function extractMetadata(page: Page): Promise<PageMetadata> {
  return page.evaluate(() => ({
    title: document.title,
    headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
      level: parseInt(h.tagName[1]),
      text: (h.textContent?.trim() || '').slice(0, 100),
    })),
    landmarks: Array.from(
      document.querySelectorAll(
        'main, nav, aside, header, footer, section[aria-label], section[aria-labelledby], [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="region"]',
      ),
    ).map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      label: el.getAttribute('aria-label') || '',
    })),
    navLinks: Array.from(document.querySelectorAll('nav a')).map((a) => ({
      text: (a.textContent?.trim() || '').slice(0, 80),
      href: (a as HTMLAnchorElement).pathname,
    })),
    lang: document.documentElement.lang || '',
    hasSkipLink: !!document.querySelector(
      'a[href^="#main"], a[href^="#content"], .skip-link, .skip-to-content',
    ),
  }));
}

async function extractLinks(page: Page): Promise<string[]> {
  return page.$$eval('a[href]', (anchors) =>
    anchors
      .map((a) => (a as HTMLAnchorElement).href)
      .filter(
        (href) =>
          href &&
          !href.startsWith('javascript:') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:'),
      ),
  );
}

// Register the runner with the scanManager so it knows how to start crawls.
scanManager.setRunner(runCrawl);

// Export a trivial function so importing this module wires the runner in.
export function ensureCrawlerRegistered() {}
