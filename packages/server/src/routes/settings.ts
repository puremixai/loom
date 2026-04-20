import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AiConfigSchema } from '@skill-manager/shared';
import type { CenterDbStore } from '../storage/center-db.js';

const SettingsBody = z.object({
  scanPaths: z.array(z.string()).optional(),
  ai: AiConfigSchema.partial().optional(),
});

function maskApiKey<T extends { apiKey?: string }>(ai: T): T {
  if (!ai.apiKey) return ai;
  return { ...ai, apiKey: ai.apiKey.length > 8 ? `${ai.apiKey.slice(0, 4)}****${ai.apiKey.slice(-2)}` : '****' };
}

export const settingsRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  app.get('/api/settings', async () => ({
    ok: true as const,
    data: {
      scanPaths: deps.db.data.scanPaths,
      ai: maskApiKey(deps.db.data.ai),
    },
  }));

  app.put('/api/settings', async (req) => {
    const body = SettingsBody.parse(req.body);
    if (body.scanPaths) deps.db.data.scanPaths = body.scanPaths;
    if (body.ai) deps.db.data.ai = { ...deps.db.data.ai, ...body.ai };
    await deps.db.write();
    return {
      ok: true as const,
      data: {
        scanPaths: deps.db.data.scanPaths,
        ai: maskApiKey(deps.db.data.ai),
      },
    };
  });
};
