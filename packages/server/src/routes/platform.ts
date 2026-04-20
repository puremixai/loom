import type { FastifyPluginAsync } from 'fastify';
import { platform, release, arch } from 'node:os';
import { probeLinkMethod } from '../utils/platform-probe.js';
import type { CenterDbStore } from '../storage/center-db.js';
import { resolveUserSkillsDir } from '../services/user-dir.js';

export const platformRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  app.get('/api/platform', async () => {
    const linkMethodPreview = await probeLinkMethod();
    return {
      ok: true as const,
      data: {
        os: platform(),
        release: release(),
        arch: arch(),
        node: process.version,
        linkMethodPreview,
        userSkillsDir: resolveUserSkillsDir(deps.db),
      },
    };
  });
};
