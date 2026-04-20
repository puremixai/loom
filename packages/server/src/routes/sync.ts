import type { FastifyPluginAsync } from 'fastify';
import { readRules } from '../services/rule.js';
import { recommendSkills } from '../services/ai.js';
import { scanSkills } from '../services/scanner.js';
import { computeDiff } from '../services/apply-helpers.js';
import { AiConfigSchema } from '@loom/shared';
import { ProjectService } from '../services/project.js';
import type { CenterDbStore } from '../storage/center-db.js';

export const syncRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  const svc = new ProjectService(deps.db);

  app.post<{ Params: { id: string } }>('/api/projects/:id/sync', async (req, reply) => {
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const rules = await readRules(project.path);
    if (!rules) { reply.status(400); return { ok: false as const, error: { code: 'NO_RULES', message: 'rules.yaml not found' } }; }

    const parsed = AiConfigSchema.safeParse(deps.db.data.ai);
    if (!parsed.success) { reply.status(400); return { ok: false as const, error: { code: 'AI_NOT_CONFIGURED', message: 'AI config missing' } }; }

    const { skills } = await scanSkills({ scanPaths: deps.db.data.scanPaths, cachePath: deps.cachePath });
    const rec = await recommendSkills(parsed.data, {
      projectHint: rules.projectHint,
      includes: rules.includes,
      excludes: rules.excludes,
      keywords: rules.keywords,
      aiGuidance: rules.aiGuidance,
      skills,
    });
    const desiredIds = rec.picks.map(p => p.skill.id);
    const diff = await computeDiff({ db: deps.db, cachePath: deps.cachePath, projectPath: project.path, desiredIds });
    return { ok: true as const, data: { picks: rec.picks, diff, warnings: rec.warnings, desiredIds } };
  });
};
