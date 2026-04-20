'use client';

import { useEffect, useRef, useReducer, useCallback } from 'react';
import type { SSEEvent } from '@/types/scan';

export interface PageProgress {
  url: string;
  pageIndex: number;
  status: 'crawling' | 'success' | 'error' | 'skipped';
  score?: number;
  issueCount?: number;
  criticalCount?: number;
  error?: string;
  reason?: string;
}

interface SSEState {
  pages: PageProgress[];
  status: 'connecting' | 'queued' | 'running' | 'complete' | 'error' | 'cancelled';
  error: string | null;
  overallScore: number | null;
  queuePosition: number | null;
  totalDiscovered: number;
  crossPageScore: number | null;
}

type SSEAction =
  | { type: 'event'; event: SSEEvent }
  | { type: 'connection-error'; error: string }
  | { type: 'historical'; status: string };

function reducer(state: SSEState, action: SSEAction): SSEState {
  if (action.type === 'connection-error') {
    return { ...state, status: 'error', error: action.error };
  }
  if (action.type === 'historical') {
    const s = action.status as SSEState['status'];
    return { ...state, status: s };
  }

  const event = action.event;
  switch (event.type) {
    case 'scan-queued':
      return { ...state, status: 'queued', queuePosition: event.position };
    case 'scan-started':
      return { ...state, status: 'running', queuePosition: null };
    case 'page-started': {
      if (state.pages.find((p) => p.url === event.url)) return state;
      return {
        ...state,
        totalDiscovered: Math.max(state.totalDiscovered, event.totalDiscovered),
        pages: [
          ...state.pages,
          { url: event.url, pageIndex: event.pageIndex, status: 'crawling' },
        ],
      };
    }
    case 'page-complete':
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.url === event.url
            ? {
                ...p,
                status: 'success',
                score: event.score,
                issueCount: event.issueCount,
                criticalCount: event.criticalCount,
              }
            : p,
        ),
      };
    case 'page-error':
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.url === event.url ? { ...p, status: 'error', error: event.error } : p,
        ),
      };
    case 'page-skipped':
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.url === event.url ? { ...p, status: 'skipped', reason: event.reason } : p,
        ),
      };
    case 'cross-page-complete':
      return { ...state, crossPageScore: event.consistencyScore };
    case 'scan-complete':
      return { ...state, status: 'complete', overallScore: event.overallScore };
    case 'scan-error':
      return { ...state, status: 'error', error: event.error };
    default:
      return state;
  }
}

const initialState: SSEState = {
  pages: [],
  status: 'connecting',
  error: null,
  overallScore: null,
  queuePosition: null,
  totalDiscovered: 0,
  crossPageScore: null,
};

export function useSSE(scanId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const seenIds = useRef(new Set<number>());

  const processEvent = useCallback((id: number, data: string) => {
    if (seenIds.current.has(id)) return;
    seenIds.current.add(id);
    try {
      const event: SSEEvent = JSON.parse(data);
      dispatch({ type: 'event', event });
    } catch {}
  }, []);

  useEffect(() => {
    if (!scanId) return;

    seenIds.current.clear();
    const es = new EventSource(`/api/scans/${scanId}/events`);

    es.onmessage = (e) => {
      const id = parseInt(e.lastEventId, 10);
      processEvent(isNaN(id) ? Date.now() : id, e.data);
    };

    // Historical event from the server for scans no longer in memory
    es.addEventListener('historical', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        dispatch({ type: 'historical', status: data.status });
      } catch {}
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        dispatch({ type: 'connection-error', error: 'Connection closed' });
      }
    };

    return () => es.close();
  }, [scanId, processEvent]);

  return state;
}
