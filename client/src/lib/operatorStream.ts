// ─── SSE streaming client for Operator chat ───────────────
// Uses fetch + ReadableStream because EventSource doesn't support POST

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onThinking: (step: string) => void;
  onComponent: (component: any) => void;
  onReset: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

export interface SendMeta {
  autonomyPreset?: string;   // autonomous | supervised | balanced | plan
  model?: string;            // gpt-4o | o3-mini
  pageContext?: string;      // current page context — injected server-side as system message, never stored
  pageContexts?: string[];   // additional linked entity contexts — each injected as a separate system message
}

export async function sendOperatorMessage(
  sessionId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  meta?: SendMeta,
): Promise<void> {
  const res = await fetch(`/api/operator/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, ...meta }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    callbacks.onError(err.error ?? `HTTP ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) { callbacks.onError('No response body'); return; }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventName = 'message';
      let data = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6);
      }

      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        switch (eventName) {
          case 'token':     callbacks.onToken(parsed.content ?? ''); break;
          case 'thinking':  callbacks.onThinking(parsed.step ?? ''); break;
          case 'component': callbacks.onComponent(parsed.component); break;
          case 'reset':     callbacks.onReset(); break;
          case 'done':      callbacks.onDone(); break;
          case 'error':     callbacks.onError(parsed.message ?? 'Stream error'); break;
        }
      } catch { /* ignore */ }
    }
  }
}
