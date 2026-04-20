import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { healthRoutes } from './routes/health.js';
import { skillsRoutes } from './routes/skills.js';
import { projectsRoutes } from './routes/projects.js';
import { aiRoutes } from './routes/ai.js';
import { settingsRoutes } from './routes/settings.js';
import { syncRoutes } from './routes/sync.js';
import { platformRoutes } from './routes/platform.js';
import { openCenterDb, type CenterDbStore } from './storage/center-db.js';
import { resolveWebDist } from './utils/static.js';

export interface BuildOptions {
  logger?: boolean;
  dbFile?: string;
  cachePath?: string;
  db?: CenterDbStore;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: /^http:\/\/(127\.0\.0\.1|localhost):\d+$/ });

  const db = opts.db ?? await openCenterDb(opts.dbFile);

  await app.register(healthRoutes);
  await app.register(skillsRoutes({ db, cachePath: opts.cachePath }));
  await app.register(projectsRoutes({ db, cachePath: opts.cachePath }));
  await app.register(aiRoutes({ db, cachePath: opts.cachePath }));
  await app.register(settingsRoutes({ db }));
  await app.register(syncRoutes({ db, cachePath: opts.cachePath }));
  await app.register(platformRoutes);

  app.setErrorHandler((err, _req, reply) => {
    reply.status(err.statusCode ?? 500).send({
      ok: false,
      error: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
    });
  });

  const webDist = resolveWebDist();
  if (webDist) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/', decorateReply: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
      } else {
        reply.type('text/html').sendFile('index.html');
      }
    });
  }

  return app;
}
