/**
 * The running e2e stack as written by `node e2e/stack.mjs up` (<E2E_RUN_DIR>/stack.json): ports, base URL, DB credentials.
 * Refuses anything that is not the local loopback stack, so a spec can never drive or query the live site.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface StackInfo {
  runDir: string;
  dbPort: number;
  apiPort: number;
  webPort: number;
  socket: string;
  baseURL: string;
  apiURL: string;
  db: { host: string; port: number; user: string; password: string; database: string; socket: string };
  stateDirs: Record<string, string>;
  seededAt?: string;
  state?: string;
}

/** Android Chrome (the SPA's MOBILE_AGENT regex and the PHP include_function.php:1322 regex both match "Android"). */
export const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36';

const LIVE_PORTS = new Set([3100, 3306, 3199, 4173, 33306]);

let cached: StackInfo | null = null;

export function loadStack(): StackInfo {
  if (cached) return cached;
  const runDir = process.env.E2E_RUN_DIR;
  if (!runDir) throw new Error('E2E_RUN_DIR is not set — start the stack with `node e2e/stack.mjs up` and export the same E2E_RUN_DIR (see e2e/README.md)');
  const file = path.join(path.resolve(runDir), 'stack.json');
  let info: StackInfo;
  try { info = JSON.parse(fs.readFileSync(file, 'utf8')) as StackInfo; } catch { throw new Error(`${file} not found — run \`node e2e/stack.mjs up\` first`); }
  const url = new URL(info.baseURL);
  if (url.hostname !== '127.0.0.1' || LIVE_PORTS.has(Number(url.port))) throw new Error(`refusing base URL ${info.baseURL}: e2e runs only against the local stack`);
  if (info.db.host !== '127.0.0.1' || LIVE_PORTS.has(info.db.port)) throw new Error(`refusing DB ${info.db.host}:${info.db.port}: e2e queries only the local test DB`);
  cached = info;
  return info;
}

/** <run>/screenshots — one PNG per page per viewport (not committed). */
export const screenshotRoot = () => path.join(loadStack().runDir, 'screenshots');
/** <run>/downloads — files saved by download tests. */
export const downloadRoot = () => path.join(loadStack().runDir, 'downloads');
