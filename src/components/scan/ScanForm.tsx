'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(1);
  const [pageLimit, setPageLimit] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cookiesJson, setCookiesJson] = useState('');
  const [localStorageJson, setLocalStorageJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (including https://)');
      return;
    }

    const body: Record<string, unknown> = { url, maxDepth, pageLimit };

    if (cookiesJson.trim()) {
      try {
        body.cookies = JSON.parse(cookiesJson);
      } catch {
        setError('Cookies must be valid JSON');
        return;
      }
    }

    if (localStorageJson.trim()) {
      try {
        body.localStorage = JSON.parse(localStorageJson);
      } catch {
        setError('localStorage must be valid JSON');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }
      const { scanId } = await res.json();
      router.push(`/scans/${scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="fade-in" style={{ maxWidth: 640 }}>
      <div className="field-group" style={{ marginBottom: 20 }}>
        <label className="field-label" htmlFor="url">URL to scan</label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          autoFocus
          className="input mono"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="field-group">
          <label className="field-label" htmlFor="maxDepth">Max depth</label>
          <input
            id="maxDepth"
            type="number"
            min={0}
            max={5}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            className="input mono"
          />
          <span className="field-hint">0 = single page only</span>
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="pageLimit">Page limit</label>
          <input
            id="pageLimit"
            type="number"
            min={1}
            max={50}
            value={pageLimit}
            onChange={(e) => setPageLimit(Number(e.target.value))}
            className="input mono"
          />
          <span className="field-hint">1–50 pages</span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'var(--font-ibm-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {showAdvanced ? '[ \u2212 ] HIDE' : '[ + ] SHOW'} AUTHENTICATION OPTIONS
        </button>
      </div>

      {showAdvanced && (
        <div
          style={{
            padding: 20,
            background: 'var(--bg-surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
          }}
        >
          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Cookies (JSON array)</label>
            <textarea
              value={cookiesJson}
              onChange={(e) => setCookiesJson(e.target.value)}
              placeholder={'[\n  { "name": "session", "value": "abc", "domain": "example.com" }\n]'}
              rows={4}
              className="textarea mono"
            />
          </div>
          <div className="field-group">
            <label className="field-label">localStorage (JSON object)</label>
            <textarea
              value={localStorageJson}
              onChange={(e) => setLocalStorageJson(e.target.value)}
              placeholder={'{ "token": "xyz" }'}
              rows={3}
              className="textarea mono"
            />
          </div>
        </div>
      )}

      {error && <div className="alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" />
            <span>STARTING...</span>
          </>
        ) : (
          <span>INITIATE_SCAN &rarr;</span>
        )}
      </button>
    </form>
  );
}
