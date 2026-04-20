import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ProjectService } from '../services/project.js';
import type { CenterDbStore } from '../storage/center-db.js';
import { applySkills, unapplySkills, computeDiff, resolveSkills, getLock } from '../services/apply-helpers.js';
import { readManifest } from '../services/manifest.js';
import { readRules, writeRules } from '../services/rule.js';
import { RuleFileSchema } from '@skill-manager/shared';

const AddBody = z.object({ path: z.string().min(1), name: z.string().optional(), notes: z.string().optional() });
const PatchBody = z.object({ name: z.string().optional(), path: z.string().optional(), notes: z.string().optional() });
const ApplyBody = z.object({ skillIds: z.array(z.string()).min(1) });
const UnapplyBody = z.object({ skillIds: z.array(z.string()).optional() });
const DiffBody = z.object({ skillIds: z.array(z.string()) });

export const projectsRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  const svc = new ProjectService(deps.db);

  app.get('/api/projects', async () => ({ ok: true as const, data: await svc.list() }));

  app.post('/api/projects', async (req) => {
    const body = AddBody.parse(req.body);
    const project = await svc.add(body);
    return { ok: true as const, data: project };
  });

  app.patch<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    const body = PatchBody.parse(req.body);
    return { ok: true as const, data: await svc.update(req.params.id, body) };
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    await svc.remove(req.params.id);
    return { ok: true as const, data: { id: req.params.id } };
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/manifest', async (req, reply) => {
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    return { ok: true as const, data: { manifest: await readManifest(project.path) } };
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/diff-preview', async (req, reply) => {
    const body = DiffBody.parse(req.body);
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const diff = await computeDiff({ db: deps.db, cachePath: deps.cachePath, projectPath: project.path, desiredIds: body.skillIds });
    return { ok: true as const, data: diff };
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/apply', async (req, reply) => {
    const body = ApplyBody.parse(req.body);
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const lock = getLock(project.id);
    return lock.runExclusive(async () => {
      const { found, missing } = await resolveSkills(deps.db, deps.cachePath, body.skillIds);
      if (missing.length > 0) {
        reply.status(400);
        return { ok: false as const, error: { code: 'UNKNOWN_SKILLS', message: `Unknown skill IDs: ${missing.join(', ')}` } };
      }
      const current = await readManifest(project.path);
      const result = await applySkills({ projectPath: project.path, desiredSkills: found, currentManifest: current });
      deps.db.data.projects = deps.db.data.projects.map(p => p.id === project.id ? { ...p, lastSyncedAt: new Date().toISOString() } : p);
      await deps.db.write();
      return { ok: true as const, data: result };
    });
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/unapply', async (req, reply) => {
    const body = UnapplyBody.parse(req.body ?? {});
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const manifest = await readManifest(project.path);
    if (!manifest) return { ok: true as const, data: { removed: [], remaining: null, warnings: [] } };
    const lock = getLock(project.id);
    return lock.runExclusive(async () => {
      const result = await unapplySkills({ projectPath: project.path, manifest, skillIds: body.skillIds });
      return { ok: true as const, data: result };
    });
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/rules', async (req, reply) => {
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const rules = await readRules(project.path);
    return { ok: true as const, data: { rules } };
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/rules', async (req, reply) => {
    const rules = RuleFileSchema.parse(req.body);
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    await writeRules(project.path, rules);
    return { ok: true as const, data: { rules } };
  });
};
