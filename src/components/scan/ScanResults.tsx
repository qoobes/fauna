import type { ScanResult } from '@/types/scan';
import { ScoreHeader } from './ScoreHeader';
import { IssuesSummary } from './IssuesSummary';
import { PagesList } from './PagesList';
import { CrossPageAnalysis } from './CrossPageAnalysis';
import { AiStatusBanner } from './AiStatusBanner';

export function ScanResults({ result }: { result: ScanResult }) {
  return (
    <div className="fade-in">
      <AiStatusBanner result={result} />
      <ScoreHeader result={result} />
      <IssuesSummary result={result} />
      <PagesList result={result} />
      {result.crossPageAnalysis && <CrossPageAnalysis analysis={result.crossPageAnalysis} />}
    </div>
  );
}
