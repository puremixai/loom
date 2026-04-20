import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ProjectService } from '../services/project.js';
import type { CenterDbStore } from '../storage/center-db.js';

const AddBody = z.object({ path: z.string().min(1), name: z.string().optional(), notes: z.string().optional() });
const PatchBody = z.object({ name: z.string().optional(), path: z.string().optional(), notes: z.string().optional() });

export const projectsRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  const svc = new ProjectService(deps.db);

  app.get('/api/projects', async () => ({ ok: true as const, data: await svc.list() }));

  app.post('/api/projects', async (req) => {
    const body = AddBody.parse(req.body);
    const project = await svc.add(body);
    return { ok: true as const, data: project };
  });

  app.patch<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    const body = PatchBody.parse(req.body);
    const project = await svc.update(req.params.id, body);
    return { ok: true as const, data: project };
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    await svc.remove(req.params.id);
    return { ok: true as const, data: { id: req.params.id } };
  });
};
