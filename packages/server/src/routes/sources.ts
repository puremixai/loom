import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SourceRefSchema } from '@loom/shared';
import { scanSkills } from '../services/scanner.js';
import { detectGitRoots, checkUpdate, pullRepo } from '../services/source-update.js';
import type { CenterDbStore } from '../storage/center-db.js';

const CheckBody = z.object({ refs: z.array(SourceRefSchema).optional() });
const PullBody = z.object({ gitRoot: z.string().min(1) });

let inflightCheck: Promise<unknown> | null = null;

export const sourcesRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  app.get('/api/sources', async () => {
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      cachePath: deps.cachePath,
    });
    const refs = await detectGitRoots(skills);
    return { ok: true as const, data: { refs } };
  });

  app.post('/api/sources/check', async (req) => {
    const body = CheckBody.parse(req.body ?? {});
    const work = async () => {
      let refs = body.refs;
      if (!refs) {
        const { skills } = await scanSkills({
          scanPaths: deps.db.data.scanPaths,
          userSkillsDir: deps.db.data.userSkillsDir,
          cachePath: deps.cachePath,
        });
        refs = await detectGitRoots(skills);
      }
      const concurrency = 5;
      const statuses: Awaited<ReturnType<typeof checkUpdate>>[] = [];
      for (let i = 0; i < refs.length; i += concurrency) {
        const chunk = refs.slice(i, i + concurrency);
        const results = await Promise.all(chunk.map(r => checkUpdate(r)));
        statuses.push(...results);
      }
      return statuses;
    };
    if (!inflightCheck) inflightCheck = work().finally(() => { inflightCheck = null; });
    const statuses = (await inflightCheck) as Awaited<ReturnType<typeof checkUpdate>>[];
    return { ok: true as const, data: { statuses } };
  });

  app.post('/api/sources/pull', async (req, reply) => {
    const body = PullBody.parse(req.body);
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      cachePath: deps.cachePath,
    });
    const refs = await detectGitRoots(skills);
    const ref = refs.find(r => r.gitRoot === body.gitRoot);
    if (!ref) {
      reply.status(404);
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'gitRoot not found' } };
    }
    if (ref.kind !== 'git-source') {
      reply.status(400);
      return { ok: false as const, error: { code: 'CANNOT_PULL_PLUGIN', message: 'Use the claude CLI to update plugins' } };
    }
    const result = await pullRepo(ref);
    return { ok: true as const, data: result };
  });
};
