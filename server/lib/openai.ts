import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') {
  console.warn('[openai] WARNING: OPENAI_API_KEY not set. Operator AI features will not work.');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'missing',
  maxRetries: 2,
  timeout: 60000,
});

export type ModelMode = 'gpt-4o-mini' | 'gpt-4o';

/** Helper: emit a server-sent event line */
export function sseEvent(res: import('express').Response, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
