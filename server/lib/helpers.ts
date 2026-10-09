import { randomUUID } from 'crypto';

export const uid = () => randomUUID();

export const now = () => new Date().toISOString();

export const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export const toJson = (v: unknown) => JSON.stringify(v);

/** Generate TR-XXXX style IDs */
let issueCounter = 1000;
export const nextIssueId = () => `TR-${++issueCounter}`;

/** Generate ev_XXXX style IDs */
let eventCounter = 1000;
export const nextEventId = () => `ev_${++eventCounter}`;

/** Format seconds as "2m 34s" */
export const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

/** Format elapsed ms as "00:15.5" */
export const formatTimestamp = (ms: number) => {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
};

export const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const WORKSPACE_ID = 'ws_demo';
export const OWNER_ID = 'user_dh';
