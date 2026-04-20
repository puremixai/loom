import { z } from 'zod';

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  source: z.enum(['user', 'custom', 'plugin']),
  sourceRoot: z.string(),
  absolutePath: z.string(),
  skillDir: z.string(),
  pluginName: z.string().optional(),
  fingerprint: z.string(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),
  addedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const RuleFileSchema = z.object({
  version: z.literal(1),
  projectHint: z.string(),
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  aiGuidance: z.string().optional(),
  lastAppliedSkills: z.array(z.string()).optional(),
});
export type RuleFile = z.infer<typeof RuleFileSchema>;

export const ManifestEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceDir: z.string(),
  linkedAs: z.string(),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z.object({
  version: z.literal(1),
  tool: z.literal('skill-manager'),
  appliedAt: z.string().datetime(),
  method: z.enum(['symlink', 'junction', 'copy']),
  skills: z.array(ManifestEntrySchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const AiConfigSchema = z.object({
  endpoint: z.string().url(),
  model: z.string().min(1),
  apiKeyEnv: z.string().optional(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  systemPrompt: z.string().optional(),
  requestStyle: z.enum(['openai', 'anthropic']).default('openai'),
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

export const CenterDbSchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  scanPaths: z.array(z.string()).default([]),
  ai: AiConfigSchema.partial().default({}),
});
export type CenterDb = z.infer<typeof CenterDbSchema>;

export const ApplyRequestSchema = z.object({
  skillIds: z.array(z.string()).min(1),
});
export const UnapplyRequestSchema = z.object({
  skillIds: z.array(z.string()).optional(),
});
export const DiffPreviewSchema = z.object({
  toAdd: z.array(SkillSchema),
  toKeep: z.array(SkillSchema),
  toRemove: z.array(ManifestEntrySchema),
});
export type DiffPreview = z.infer<typeof DiffPreviewSchema>;

export const AiRecommendRequestSchema = z.object({
  projectId: z.string(),
  projectHint: z.string(),
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  aiGuidance: z.string().optional(),
});

export const AiRecommendResultSchema = z.object({
  picks: z.array(z.object({
    skill: SkillSchema,
    reason: z.string(),
  })),
  warnings: z.array(z.string()).default([]),
});
