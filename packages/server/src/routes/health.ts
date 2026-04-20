import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => ({
    ok: true as const,
    data: { status: 'up', version: '0.1.0', uptimeSec: Math.floor(process.uptime()) },
  }));
};
