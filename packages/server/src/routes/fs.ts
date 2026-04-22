import type { FastifyPluginAsync } from 'fastify';
import { browseDirectory } from '../services/fs-browse.js';

export const fsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { path?: string } }>('/api/fs/browse', async (req) => {
    const result = await browseDirectory(req.query.path);
    return { ok: true as const, data: result };
  });
};
