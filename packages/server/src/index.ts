import { buildApp } from './app.js';
import { DEFAULT_PORT } from '@skill-manager/shared';
import open from 'open';

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const host = '127.0.0.1';

const app = await buildApp({ logger: true });

await app.listen({ port, host });
console.log(`Skill Manager running at http://${host}:${port}`);

if (process.env.NO_OPEN !== '1') {
  await open(`http://${host}:${port}`);
}
