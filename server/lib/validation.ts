import { z } from 'zod';
import type { RequestHandler } from 'express';
export const url = z.string().trim().url().refine(v => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } }, 'Use an HTTP or HTTPS URL');
export const stepSchema = z.object({ id: z.string().optional(), order: z.number().int().nonnegative(), action: z.string().trim().min(1), type: z.enum(['navigate','click','fill','assert','wait','screenshot']).default('click'), target: z.string().default(''), value: z.string().default(''), css: z.boolean().default(false), stable: z.boolean().default(true), pressEnter: z.boolean().default(false), captureScreenshot: z.boolean().default(false), isAiGenerated: z.boolean().default(false), generatedAction: z.string().default('') });
export const testSchema = z.object({ name: z.string().trim().min(1).max(200), projectId: z.string().nullable().optional(), mode: z.enum(['autonomous','deterministic']), entryPoint: url, environment: z.enum(['production','staging','local']).default('staging'), runnerMode: z.enum(['fast','standard','deep']).default('standard'), customPrompt: z.string().nullable().optional(), auth: z.string().optional(), estimatedCredits: z.number().int().positive().max(10000).optional(), viewport: z.object({ mode: z.enum(['single','multi']), single: z.enum(['desktop','tablet','mobile']).optional(), multi: z.array(z.enum(['desktop','tablet','mobile'])).min(1).optional() }).optional(), triggers: z.object({ onPr: z.boolean(), onDeploy: z.boolean(), scheduled: z.boolean(), cronExpression: z.string().optional() }).optional(), defaultReports: z.array(z.string()).optional(), suiteIds: z.array(z.string()).optional(), tags: z.array(z.string()).optional(), selfHealing: z.boolean().optional(), screenshotOnFailure: z.boolean().optional(), selfHealingSensitivity: z.string().optional(), steps: z.array(stepSchema).max(100).optional(), archived: z.boolean().optional() });
export function validate(bodySchema: z.ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }); return; }
    req.body = parsed.data; next();
  };
}
export const pageNumber = (value: string) => Math.max(1, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 1);
