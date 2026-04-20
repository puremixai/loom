export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

/**
 * Fetch wrapper that unwraps the `{ ok, data | error }` envelope.
 * Only sets `Content-Type: application/json` when a body is actually
 * being sent — Fastify's default JSON parser rejects empty bodies
 * that arrive with a JSON content-type (FST_ERR_CTP_EMPTY_JSON_BODY).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && init?.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...init, headers });
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!body.ok) throw new Error(`${body.error.code}: ${body.error.message}`);
  return body.data;
}
