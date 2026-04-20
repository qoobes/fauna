import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { env } from '@/env';
import type { ScanResult } from '@/types/scan';

function resultsDir(): string {
  return path.resolve(env.RESULTS_DIR);
}

export async function ensureScanDir(scanId: string) {
  await mkdir(path.join(resultsDir(), scanId, 'screenshots'), { recursive: true });
  await mkdir(path.join(resultsDir(), scanId, 'raw'), { recursive: true });
}

export async function saveScreenshot(scanId: string, filename: string, buffer: Buffer) {
  await writeFile(path.join(resultsDir(), scanId, 'screenshots', filename), buffer);
}

export async function saveRawResult(scanId: string, urlHash: string, type: 'axe' | 'ai', data: unknown) {
  await writeFile(
    path.join(resultsDir(), scanId, 'raw', `${urlHash}-${type}.json`),
    JSON.stringify(data, null, 2)
  );
}

export async function saveScanJson(scanId: string, result: ScanResult) {
  await writeFile(
    path.join(resultsDir(), scanId, 'scan.json'),
    JSON.stringify(result, null, 2)
  );
}

export function screenshotPath(scanId: string, filename: string): string {
  return path.join(resultsDir(), scanId, 'screenshots', filename);
}
