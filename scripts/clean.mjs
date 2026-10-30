import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

await Promise.all([
  rm(join(projectRoot, 'dist'), { recursive: true, force: true }),
  rm(join(projectRoot, 'server.js'), { force: true }),
]);
