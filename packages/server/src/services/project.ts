import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { ProjectSchema, type Project } from '@loom/shared';
import type { CenterDbStore } from '../storage/center-db.js';

export interface ProjectStatus extends Project {
  status: 'ok' | 'broken';
}

export async function pathExistsDir(p: string): Promise<boolean> {
  try { const s = await stat(p); return s.isDirectory(); } catch { return false; }
}

export class ProjectService {
  constructor(private db: CenterDbStore) {}

  async list(): Promise<ProjectStatus[]> {
    const out: ProjectStatus[] = [];
    for (const p of this.db.data.projects) {
      const status = (await pathExistsDir(p.path)) ? 'ok' : 'broken';
      out.push({ ...p, status });
    }
    return out;
  }

  async get(id: string): Promise<ProjectStatus | null> {
    const found = this.db.data.projects.find(p => p.id === id);
    if (!found) return null;
    const status = (await pathExistsDir(found.path)) ? 'ok' : 'broken';
    return { ...found, status };
  }

  async add(input: { path: string; name?: string; notes?: string }): Promise<Project> {
    const absPath = resolve(input.path);
    if (!(await pathExistsDir(absPath))) {
      throw Object.assign(new Error(`Path does not exist or is not a directory: ${absPath}`), { statusCode: 400, code: 'INVALID_PATH' });
    }
    if (this.db.data.projects.some(p => p.path === absPath)) {
      throw Object.assign(new Error(`Project already registered: ${absPath}`), { statusCode: 409, code: 'DUPLICATE' });
    }
    const project: Project = ProjectSchema.parse({
      id: randomUUID(),
      name: input.name?.trim() || basename(absPath),
      path: absPath,
      addedAt: new Date().toISOString(),
      notes: input.notes,
    });
    this.db.data.projects.push(project);
    await this.db.write();
    return project;
  }

  async update(id: string, patch: Partial<Pick<Project, 'name' | 'path' | 'notes'>>): Promise<Project> {
    const idx = this.db.data.projects.findIndex(p => p.id === id);
    if (idx < 0) throw Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' });
    const current = this.db.data.projects[idx]!;
    const resolvedPath = patch.path ? resolve(patch.path) : undefined;
    if (resolvedPath && !(await pathExistsDir(resolvedPath))) {
      throw Object.assign(new Error(`Path does not exist: ${resolvedPath}`), { statusCode: 400, code: 'INVALID_PATH' });
    }
    const next = { ...current, ...patch, ...(resolvedPath ? { path: resolvedPath } : {}) };
    this.db.data.projects[idx] = ProjectSchema.parse(next);
    await this.db.write();
    return this.db.data.projects[idx]!;
  }

  async remove(id: string): Promise<void> {
    const before = this.db.data.projects.length;
    this.db.data.projects = this.db.data.projects.filter(p => p.id !== id);
    if (this.db.data.projects.length === before) {
      throw Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    await this.db.write();
  }
}
