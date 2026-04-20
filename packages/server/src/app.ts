import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';

export interface BuildOptions {
  logger?: boolean;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: /^http:\/\/(127\.0\.0\.1|localhost):\d+$/ });
  await app.register(healthRoutes);

  app.setErrorHandler((err, _req, reply) => {
    reply.status(err.statusCode ?? 500).send({
      ok: false,
      error: {
        code: err.code ?? 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  });

  return app;
}
