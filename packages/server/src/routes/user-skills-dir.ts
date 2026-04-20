import type { FastifyPluginAsync } from 'fastify';
import open from 'open';
import { resolveUserSkillsDir } from '../services/user-dir.js';
import type { CenterDbStore } from '../storage/center-db.js';

export const userSkillsDirRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  app.post('/api/user-skills-dir/open', async (_req, reply) => {
    const dir = resolveUserSkillsDir(deps.db);
    try {
      await open(dir);
      return { ok: true as const, data: { path: dir } };
    } catch (err) {
      reply.status(500);
      return { ok: false as const, error: { code: 'OPEN_FAILED', message: (err as Error).message } };
    }
  });
};
