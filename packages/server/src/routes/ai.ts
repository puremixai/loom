import type { FastifyPluginAsync } from 'fastify';
import { AiRecommendRequestSchema, AiConfigSchema } from '@loom/shared';
import { recommendSkills, testConnection } from '../services/ai.js';
import { scanSkills } from '../services/scanner.js';
import type { CenterDbStore } from '../storage/center-db.js';

export const aiRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  app.post('/api/ai/recommend', async (req, reply) => {
    const body = AiRecommendRequestSchema.parse(req.body);
    const parsed = AiConfigSchema.safeParse(deps.db.data.ai);
    if (!parsed.success) {
      reply.status(400);
      return { ok: false as const, error: { code: 'AI_NOT_CONFIGURED', message: 'AI endpoint/model not configured in settings.' } };
    }
    const { skills } = await scanSkills({ scanPaths: deps.db.data.scanPaths, userSkillsDir: deps.db.data.userSkillsDir, cachePath: deps.cachePath });
    const result = await recommendSkills(parsed.data, {
      projectHint: body.projectHint,
      includes: body.includes,
      excludes: body.excludes,
      keywords: body.keywords,
      aiGuidance: body.aiGuidance,
      skills,
    });
    return { ok: true as const, data: result };
  });

  app.post('/api/ai/test', async (req, reply) => {
    const parsed = AiConfigSchema.safeParse(deps.db.data.ai);
    if (!parsed.success) {
      reply.status(400);
      return { ok: false as const, error: { code: 'AI_NOT_CONFIGURED', message: 'AI endpoint/model not configured.' } };
    }
    const result = await testConnection(parsed.data);
    return { ok: true as const, data: result };
  });
};
