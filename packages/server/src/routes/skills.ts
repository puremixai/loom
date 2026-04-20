import type { FastifyPluginAsync } from 'fastify';
import type { CenterDbStore } from '../storage/center-db.js';
import { scanSkills } from '../services/scanner.js';

export interface SkillsRoutesDeps {
  db: CenterDbStore;
  cachePath?: string;
}

export const skillsRoutes = (deps: SkillsRoutesDeps): FastifyPluginAsync => async (app) => {
  app.get<{ Querystring: { refresh?: string } }>('/api/skills', async (req) => {
    const forceRefresh = req.query.refresh === '1';
    const { skills, warnings } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      cachePath: deps.cachePath,
      forceRefresh,
    });
    return { ok: true as const, data: { skills, warnings } };
  });

  app.get<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      cachePath: deps.cachePath,
    });
    const skill = skills.find(s => s.id === req.params.id);
    if (!skill) {
      reply.status(404);
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Skill not found' } };
    }
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(skill.absolutePath, 'utf8');
    return { ok: true as const, data: { skill, content } };
  });
};
