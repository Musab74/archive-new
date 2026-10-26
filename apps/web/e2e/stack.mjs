#!/usr/bin/env node
// AINEX e2e stack launcher: throwaway MariaDB 10.3 + the NestJS API + the SPA (vite preview), all inside one run folder.
//
//   node e2e/stack.mjs up        fresh DB (schema + base seed + e2e fixtures + media), build + start API and web
//   node e2e/stack.mjs down      stop everything this run folder started
//   node e2e/stack.mjs status    what is running (pids, ports, health)
//   node e2e/stack.mjs reseed    reload schema + fixtures + media into the running DB, restart the API (no rebuild)
//   node e2e/stack.mjs restart-api [--skip-build]   rebuild (nest build) and restart only the API
//   node e2e/stack.mjs rebuild-web [--skip-build]   rebuild the SPA and restart the preview server
//
// Parameters (flag or env; flags win):
//   --api-tree / AINEX_API_TREE   monorepo checkout (its root or its new-codebase/ folder) — the API is built and run from it
//   --run-dir  / E2E_RUN_DIR      run folder (DB datadir, logs, state dirs, web build, Playwright output); required
//   --db-port  / E2E_DB_PORT      local MariaDB port          --api-port / E2E_API_PORT   API port
//   --web-port / E2E_WEB_PORT     preview port (the browser's base URL http://127.0.0.1:<port>)
//   --skip-build                  up: reuse the existing API dist and web build
//   E2E_API_<NAME>=value          extra/override API env (e.g. E2E_API_HLS_PLAYBACK=prefer); still checked by the guard
//
// The guard refuses to start when any state dir resolves under a live server path, a port belongs to someone else
// (3100 live API, 33306/3199/4173 other sessions), DB_HOST is not 127.0.0.1 or the traffic sampler would run.
// Every child gets E2E_STACK_RUN_DIR=<run dir>; stop/kill only touches processes that carry it.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_APP = path.resolve(HERE, '..');            // <web tree>/apps/web
const WEB_ROOT = path.resolve(WEB_APP, '..', '..');  // <web tree>
const FIXTURES = path.join(HERE, 'fixtures');

export const FORBIDDEN_ROOTS = ['/var/lib/ainex', '/vod', '/web', '/opt', '/etc', '/var/www'];
export const FORBIDDEN_PORTS = [3100, 3306, 3199, 4173, 33306];
/** Trees this harness must never build into (shared checkouts and other sessions' worktrees). */
export const PROTECTED_TREES = ['/root/archive-new', '/root/archive-new-ghweb', '/root/archive-new-deploy', '/root/archive-deploy', '/root/archive-parity'];
const MYSQLD = '/usr/libexec/mysqld';
const DB_USER = 'ainex';
const DB_PASS = 'ainex-test';
const DB_NAME = 'hrdeArchive';

// ------------------------------------------------------------------------------------------------ args / config

function parseArgs(argv) {
  const [cmd = 'help', ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const [k, inline] = a.slice(2).split('=', 2);
    if (inline !== undefined) flags[k] = inline;
    else if (rest[i + 1] && !rest[i + 1].startsWith('--')) flags[k] = rest[++i];
    else flags[k] = true;
  }
  return { cmd, flags };
}

/** Real path of `p` even when it does not exist yet (nearest existing ancestor resolved, symlinks followed). */
export function realish(p) {
  let cur = path.resolve(p);
  const tail = [];
  for (;;) {
    try { return path.join(fs.realpathSync(cur), ...tail.reverse()); } catch { /* walk up */ }
    const parent = path.dirname(cur);
    if (parent === cur) return path.resolve(p);
    tail.push(path.basename(cur));
    cur = parent;
  }
}

const under = (p, root) => p === root || p.startsWith(root + '/');

function resolveApiTree(p) {
  if (!p) return null;
  const abs = path.resolve(p);
  if (fs.existsSync(path.join(abs, 'new-codebase', 'apps', 'api', 'package.json'))) return path.join(abs, 'new-codebase');
  if (fs.existsSync(path.join(abs, 'apps', 'api', 'package.json'))) return abs;
  throw new Error(`AINEX_API_TREE=${p} is not a monorepo checkout (no apps/api or new-codebase/apps/api)`);
}

function readStackJson(runDir) {
  try { return JSON.parse(fs.readFileSync(path.join(runDir, 'stack.json'), 'utf8')); } catch { return null; }
}

function loadConfig(cmd, flags) {
  const runDirRaw = flags['run-dir'] ?? process.env.E2E_RUN_DIR;
  if (!runDirRaw) throw new Error('E2E_RUN_DIR (or --run-dir) is required, e.g. /root/archive-e2e/<slug>-run');
  const runDir = path.resolve(runDirRaw);
  const prev = readStackJson(runDir);
  const num = (flag, envName, prevKey) => {
    const v = flags[flag] ?? process.env[envName] ?? prev?.[prevKey];
    return v === undefined || v === true ? undefined : Number(v);
  };
  const cfg = {
    runDir,
    dbPort: num('db-port', 'E2E_DB_PORT', 'dbPort'),
    apiPort: num('api-port', 'E2E_API_PORT', 'apiPort'),
    webPort: num('web-port', 'E2E_WEB_PORT', 'webPort'),
    apiTree: resolveApiTree(flags['api-tree'] ?? process.env.AINEX_API_TREE ?? prev?.apiTree),
    webRoot: WEB_ROOT,
    webApp: WEB_APP,
    skipBuild: !!flags['skip-build'],
  };
  cfg.dbDir = path.join(runDir, 'db');
  cfg.socket = path.join(cfg.dbDir, 'mysqld.sock');
  cfg.logDir = path.join(runDir, 'logs');
  cfg.stateDir = path.join(runDir, 'state');
  cfg.webDist = path.join(runDir, 'web-dist');
  cfg.dirs = {
    TRAFFIC_STATE_DIR: path.join(cfg.stateDir, 'traffic'),
    MEDIA_DIR: path.join(cfg.stateDir, 'media'),
    DESIGN_STORE_DIR: path.join(cfg.stateDir, 'design'),
    HLS_STATE_DIR: path.join(cfg.stateDir, 'hls-state'),
    HLS_ROOT: path.join(cfg.stateDir, 'contents-hls'),
    HLS_CONTENTS_ROOT: path.join(cfg.stateDir, 'contents'),
    HRDE_UPLOAD_DIR: path.join(cfg.stateDir, 'upload'),
  };
  const needPorts = ['up'].includes(cmd);
  if (needPorts) for (const k of ['dbPort', 'apiPort', 'webPort']) if (!Number.isInteger(cfg[k])) throw new Error(`${k} missing: set E2E_DB_PORT, E2E_API_PORT, E2E_WEB_PORT (or --db-port/--api-port/--web-port)`);
  if (['up', 'reseed', 'restart-api'].includes(cmd) && !cfg.apiTree) throw new Error('AINEX_API_TREE (or --api-tree) is required: path to a monorepo checkout (its new-codebase/ folder)');
  return cfg;
}

// ------------------------------------------------------------------------------------------------ guard

/** Throws when this configuration could touch live state. Called before anything is started. */
export function guard(cfg, apiEnv) {
  const problems = [];
  const run = realish(cfg.runDir);
  for (const root of FORBIDDEN_ROOTS) if (under(run, root)) problems.push(`run dir ${cfg.runDir} resolves under ${root}`);
  for (const t of PROTECTED_TREES) if (under(run, t)) problems.push(`run dir ${cfg.runDir} is inside the protected tree ${t}`);
  if (apiEnv) {
    for (const [k, v] of Object.entries(apiEnv)) {
      if (!(Object.keys(cfg.dirs).includes(k) || /(_DIR|_ROOT|_FILE)$/.test(k)) || !v) continue;
      const real = realish(v);
      for (const root of FORBIDDEN_ROOTS) if (under(real, root)) problems.push(`${k}=${v} resolves under ${root}`);
      if (Object.keys(cfg.dirs).includes(k) && !under(real, run)) problems.push(`${k}=${v} is outside the run dir ${cfg.runDir}`);
    }
    for (const k of Object.keys(cfg.dirs)) if (!apiEnv[k]) problems.push(`${k} is not set`);
    if (apiEnv.DB_HOST !== '127.0.0.1') problems.push(`DB_HOST=${apiEnv.DB_HOST} (must be 127.0.0.1)`);
    if (apiEnv.TRAFFIC_MONITOR !== 'false') problems.push('TRAFFIC_MONITOR must be false');
    if (apiEnv.HOST !== '127.0.0.1') problems.push(`HOST=${apiEnv.HOST} (must be 127.0.0.1)`);
    if (Number(apiEnv.DB_PORT) !== cfg.dbPort || Number(apiEnv.PORT) !== cfg.apiPort) problems.push('DB_PORT/PORT overrides are not allowed (use E2E_DB_PORT / E2E_API_PORT)');
  }
  const ports = [cfg.dbPort, cfg.apiPort, cfg.webPort].filter((p) => p !== undefined);
  for (const p of ports) {
    if (!Number.isInteger(p) || p < 1024 || p > 65535) problems.push(`port ${p} is not a valid unprivileged port`);
    if (FORBIDDEN_PORTS.includes(p)) problems.push(`port ${p} belongs to someone else (forbidden: ${FORBIDDEN_PORTS.join(', ')})`);
  }
  if (new Set(ports).size !== ports.length) problems.push(`ports must be distinct (${ports.join(', ')})`);
  if (cfg.apiTree) {
    const t = realish(cfg.apiTree);
    for (const p of PROTECTED_TREES) if (under(t, p)) problems.push(`AINEX_API_TREE=${cfg.apiTree} is inside the protected tree ${p} (use your own worktree)`);
  }
  const w = realish(cfg.webRoot);
  for (const p of PROTECTED_TREES) if (under(w, p)) problems.push(`the web tree ${cfg.webRoot} is inside the protected tree ${p} (run stack.mjs from your own worktree)`);
  if (problems.length) throw new Error('guard refused to start:\n  - ' + problems.join('\n  - '));
}

// ------------------------------------------------------------------------------------------------ process helpers

const log = (...a) => console.log('[stack]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** True when the process carries our run-dir marker (so a recycled pid is never killed). */
function ours(pid, runDir) {
  try { return fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`E2E_STACK_RUN_DIR=${runDir}`); } catch { return false; }
}

const pidFile = (cfg, name) => path.join(cfg.runDir, 'pids', `${name}.pid`);
function readPid(cfg, name) { try { return Number(fs.readFileSync(pidFile(cfg, name), 'utf8').trim()) || null; } catch { return null; } }

function startDetached(cfg, name, cmd, args, opts) {
  fs.mkdirSync(path.join(cfg.runDir, 'pids'), { recursive: true });
  fs.mkdirSync(cfg.logDir, { recursive: true });
  const logPath = path.join(cfg.logDir, `${name}.log`);
  const out = fs.openSync(logPath, 'a');
  fs.writeSync(out, `\n===== ${new Date().toISOString()} ${cmd} ${args.join(' ')}\n`);
  const child = spawn('nice', ['-n', '10', cmd, ...args], { cwd: opts.cwd, env: { ...opts.env, E2E_STACK_RUN_DIR: cfg.runDir }, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  fs.closeSync(out);
  fs.writeFileSync(pidFile(cfg, name), String(child.pid));
  return { pid: child.pid, logPath };
}

async function stopProcess(cfg, name, { graceMs = 15_000 } = {}) {
  const pid = readPid(cfg, name);
  if (!pid) return false;
  if (!alive(pid) || !ours(pid, cfg.runDir)) { fs.rmSync(pidFile(cfg, name), { force: true }); return false; }
  const signal = (s) => { try { process.kill(-pid, s); } catch { try { process.kill(pid, s); } catch { /* gone */ } } };
  signal('SIGTERM');
  const until = Date.now() + graceMs;
  while (alive(pid) && Date.now() < until) await sleep(200);
  if (alive(pid)) { log(`${name} (pid ${pid}) ignored SIGTERM, killing`); signal('SIGKILL'); await sleep(300); }
  fs.rmSync(pidFile(cfg, name), { force: true });
  log(`stopped ${name} (pid ${pid})`);
  return true;
}

function tail(file, lines = 40) {
  try { return fs.readFileSync(file, 'utf8').split('\n').slice(-lines).join('\n'); } catch { return '(no log)'; }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync('nice', ['-n', '10', cmd, ...args], { stdio: opts.input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status ?? r.signal}):\n${(r.stderr || '') + (r.stdout || '')}`.slice(0, 8000));
  return r.stdout;
}

/** Async variant for the two builds, so API and web compile in parallel while the DB loads. */
function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('nice', ['-n', '10', cmd, ...args], { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let buf = '';
    child.stdout.on('data', (d) => { buf += d; });
    child.stderr.on('data', (d) => { buf += d; });
    child.on('error', reject);
    child.on('close', (code, sig) => (code === 0 ? resolve(buf) : reject(new Error(`${cmd} ${args.join(' ')} failed (${code ?? sig}):\n${buf.slice(-8000)}`))));
  });
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

async function waitFor(what, fn, timeoutMs, logPath) {
  const until = Date.now() + timeoutMs;
  let last;
  while (Date.now() < until) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(500);
  }
  throw new Error(`${what} did not become ready in ${timeoutMs / 1000}s${last ? ` (${last.message})` : ''}\n--- ${logPath ?? ''}\n${logPath ? tail(logPath) : ''}`);
}

/** mkdir lock (per tree) so two stacks sharing a tree never build into it at the same time. */
async function withLock(dir, fn) {
  const lock = path.join(dir, '.e2e-build.lock');
  const until = Date.now() + 10 * 60_000;
  for (;;) {
    try { fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'pid'), String(process.pid)); break; } catch {
      const holder = Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8').trim() || 0);
      if (holder && !alive(holder)) { fs.rmSync(lock, { recursive: true, force: true }); continue; }
      if (Date.now() > until) throw new Error(`build lock ${lock} held by pid ${holder}`);
      await sleep(1000);
    }
  }
  try { return await fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

// ------------------------------------------------------------------------------------------------ env

const baseEnv = () => ({ PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '/root', LANG: 'C.UTF-8', TZ: 'Asia/Seoul' });

/** The complete API environment — built from scratch, never inherited, so a shell with the live env file loaded cannot leak in. */
export function apiEnv(cfg) {
  const web = `http://127.0.0.1:${cfg.webPort}`;
  const env = {
    ...baseEnv(),
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: String(cfg.apiPort),
    WEB_ORIGIN: `${web},http://localhost:${cfg.webPort}`,
    PUBLIC_WEB_URL: web,
    PUBLIC_API_URL: web, // /v1 is same-origin through the preview proxy
    TRUST_PROXY: '1',
    RELEASE: `e2e-${path.basename(cfg.runDir)}`,
    API_WRITE_MODE: 'full',
    PILOT_TESTID_ONLY: 'false',
    FEATURE_PLAYER_WRITES: 'true',
    FEATURE_MANAGER: 'true',
    FEATURE_ADMIN: 'true',
    FEATURE_DESIGN_STUDIO: 'true',
    FEATURE_HLS: 'true',
    // Behaviour switches keep their production values (override with E2E_API_<NAME>):
    FEATURE_SIGNUP_WITHOUT_IDENTITY: 'false',
    RUBY_ROLLOUT_ENABLED: 'false',
    KOBE_ROLLOUT_ENABLED: 'false',
    HLS_PLAYBACK: 'off',
    CDN_MODE: 'off',
    PLAYER_DAILY_CAP_ENFORCE: 'false',
    TRAFFIC_MONITOR: 'false',
    DB_HOST: '127.0.0.1',
    DB_PORT: String(cfg.dbPort),
    DB_USER,
    DB_PASS,
    DB_NAME,
    DB_POOL_SIZE: '5',
    DB_READ_ONLY: 'false',
    DB_TIMEZONE: '+09:00',
    DB_ENC_KEY: 'test-enc-key',
    AUTH_JWT_SECRET: 'e2e-auth-jwt-secret-'.padEnd(48, 'x'),
    AUTH_REFRESH_SECRET: 'e2e-auth-refresh-secret-'.padEnd(48, 'y'),
    ADMIN_JWT_SECRET: 'e2e-admin-jwt-secret-'.padEnd(48, 'z'),
    ADMIN_REFRESH_SECRET: 'e2e-admin-refresh-secret-'.padEnd(48, 'w'),
    PREVIEW_TOKEN_SECRET: 'e2e-preview-token-secret-'.padEnd(48, 'v'),
    JWT_SECRET_KEY: 'e2e-live-sso-secret-'.padEnd(48, 's'),
    COOKIE_SECURE: 'false', // http://127.0.0.1 — a Secure refresh cookie would never come back
    COOKIE_DOMAIN: '',
    OPENAI_API_KEY: '',
    ASSESSMENT_RETRO_COHORT_FILE: '',
    ROLLOUT_FLAGS_FILE: path.join(cfg.runDir, 'api-rollout.env'),
    MEDIA_PUBLIC_BASE: '/media',
    HLS_PUBLIC_BASE: '/contents-hls',
    LOG_LEVEL: process.env.E2E_API_LOG_LEVEL ?? 'warn',
    ...cfg.dirs,
  };
  for (const [k, v] of Object.entries(process.env)) {
    const m = /^E2E_API_([A-Z0-9_]+)$/.exec(k);
    if (m && m[1] !== 'LOG_LEVEL') env[m[1]] = v;
  }
  return env;
}

// ------------------------------------------------------------------------------------------------ database

function myCnf(cfg) {
  return `[mysqld]
datadir=${cfg.dbDir}/data
socket=${cfg.socket}
pid-file=${cfg.dbDir}/mysqld.pid
log-error=${cfg.dbDir}/mysqld.err
port=${cfg.dbPort}
bind-address=127.0.0.1
skip-name-resolve
user=root
character-set-server=utf8
collation-server=utf8_general_ci
default-time-zone=SYSTEM
innodb_buffer_pool_size=128M
innodb_log_file_size=48M
innodb_flush_log_at_trx_commit=2
performance_schema=OFF
skip-log-bin
max_connections=200
[client]
socket=${cfg.socket}
default-character-set=utf8
`;
}

const mysql = (cfg, args, input) => run('mysql', [`--socket=${cfg.socket}`, '-uroot', '--default-character-set=utf8', ...args], input !== undefined ? { input } : {});

async function dbStart(cfg) {
  fs.rmSync(cfg.dbDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(cfg.dbDir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(cfg.dbDir, 'my.cnf'), myCnf(cfg));
  log('initialising MariaDB datadir');
  run('mysql_install_db', [`--defaults-file=${cfg.dbDir}/my.cnf`, `--datadir=${cfg.dbDir}/data`, '--user=root', '--auth-root-authentication-method=normal', '--skip-test-db', '--skip-name-resolve']);
  const { logPath } = startDetached(cfg, 'mysqld', MYSQLD, [`--defaults-file=${cfg.dbDir}/my.cnf`], { cwd: cfg.dbDir, env: baseEnv() });
  await waitFor('MariaDB', () => { run('mysqladmin', [`--socket=${cfg.socket}`, '-uroot', 'ping']); return true; }, 60_000, path.join(cfg.dbDir, 'mysqld.err') || logPath);
  mysql(cfg, ['-e', "DELETE FROM mysql.user WHERE User=''; FLUSH PRIVILEGES;"]);
  log(`MariaDB up on 127.0.0.1:${cfg.dbPort} (socket ${cfg.socket})`);
}

/** Base schema + triggers + base seed (reset-local-db.sh of the API tree), then every e2e fixture file. */
function dbLoad(cfg) {
  const reset = path.join(cfg.apiTree, 'apps', 'api', 'test', 'integration', 'reset-local-db.sh');
  log('loading schema + base seed (reset-local-db.sh)');
  log(run('bash', [reset, cfg.socket]).trim().split('\n').join(' '));
  for (const f of fixtureSqlFiles()) {
    log(`loading fixtures/${path.basename(f)}`);
    mysql(cfg, [DB_NAME], fs.readFileSync(f, 'utf8'));
  }
  const counts = mysql(cfg, [DB_NAME, '-N', '-e', "SELECT CONCAT('members=', COUNT(*)) FROM Member; SELECT CONCAT('studies=', COUNT(*)) FROM Study; SELECT CONCAT('progress=', COUNT(*)) FROM Progress;"]);
  log(counts.trim().split('\n').join(' '));
}

/** seed.sql first, then any other fixtures/*.sql in name order (area agents add their own files instead of editing seed.sql). */
function fixtureSqlFiles() {
  const all = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.sql')).sort();
  return ['seed.sql', ...all.filter((f) => f !== 'seed.sql')].filter((f) => all.includes(f)).map((f) => path.join(FIXTURES, f));
}

// ------------------------------------------------------------------------------------------------ media / state dirs

function copyTree(src, dst) {
  if (!fs.existsSync(src)) return 0;
  let n = 0;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) { fs.mkdirSync(d, { recursive: true }); n += copyTree(s, d); }
    else if (ent.isFile()) { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d, fs.constants.COPYFILE_FICLONE); n++; }
  }
  return n;
}

/**
 * Fresh state dirs: every API state dir is emptied, then fixtures/media/{contents,upload} are copied in and the copies listed in
 * fixtures/media/manifest.json are made (one committed MP4 reused for every lesson path). Copies are reflinks (CoW), never links,
 * so nothing the API writes can reach the committed fixtures.
 */
function installState(cfg) {
  for (const d of Object.values(cfg.dirs)) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
  const media = path.join(FIXTURES, 'media');
  let n = copyTree(path.join(media, 'contents'), cfg.dirs.HLS_CONTENTS_ROOT) + copyTree(path.join(media, 'upload'), cfg.dirs.HRDE_UPLOAD_DIR);
  const manifest = JSON.parse(fs.readFileSync(path.join(media, 'manifest.json'), 'utf8'));
  for (const c of manifest.copies) {
    for (const to of c.to) {
      const [root, ...rest] = to.split('/');
      const base = root === 'contents' ? cfg.dirs.HLS_CONTENTS_ROOT : root === 'upload' ? cfg.dirs.HRDE_UPLOAD_DIR : null;
      if (!base) throw new Error(`manifest target ${to} must start with contents/ or upload/`);
      const d = path.join(base, ...rest);
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(path.join(media, c.from), d, fs.constants.COPYFILE_FICLONE);
      n++;
    }
  }
  // The PHP upload tree is world-writable; the folders the API writes into must exist.
  for (const f of manifest.uploadFolders ?? []) fs.mkdirSync(path.join(cfg.dirs.HRDE_UPLOAD_DIR, f), { recursive: true });
  log(`state dirs ready under ${cfg.stateDir} (${n} media files)`);
}

// ------------------------------------------------------------------------------------------------ API

async function apiBuild(cfg) {
  await withLock(cfg.apiTree, async () => {
    log(`building @ainex/contracts + API in ${cfg.apiTree}`);
    await runAsync('npm', ['run', 'build', '-w', '@ainex/contracts'], { cwd: cfg.apiTree });
    await runAsync(path.join(cfg.apiTree, 'node_modules', '.bin', 'nest'), ['build'], { cwd: path.join(cfg.apiTree, 'apps', 'api') });
    log('API build done');
  });
}

async function apiStart(cfg) {
  const env = apiEnv(cfg);
  guard(cfg, env);
  fs.writeFileSync(env.ROLLOUT_FLAGS_FILE, Object.entries(env).filter(([k]) => /^(API_WRITE_MODE|PILOT_|FEATURE_|HLS_PLAYBACK|CDN_|VOD_|PLAYER_DAILY|RUBY_|KOBE_)/.test(k)).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  if (!(await portFree(cfg.apiPort))) throw new Error(`API port ${cfg.apiPort} is already in use`);
  const main = path.join(cfg.apiTree, 'apps', 'api', 'dist', 'main.js');
  if (!fs.existsSync(main)) throw new Error(`${main} missing — run without --skip-build`);
  const { logPath } = startDetached(cfg, 'api', process.execPath, [main], { cwd: path.join(cfg.apiTree, 'apps', 'api'), env });
  const health = await waitFor('API /health/ready', async () => {
    const r = await fetch(`http://127.0.0.1:${cfg.apiPort}/health/ready`);
    const j = await r.json();
    return r.ok && j.status === 'ready' ? j : null;
  }, 90_000, logPath);
  log(`API up on 127.0.0.1:${cfg.apiPort} ${JSON.stringify(health.checks)}`);
}

// ------------------------------------------------------------------------------------------------ web

async function webBuild(cfg) {
  await withLock(cfg.webRoot, async () => {
    log(`building @ainex/contracts + SPA from ${cfg.webApp} into ${cfg.webDist}`);
    await runAsync('npm', ['run', 'build', '-w', '@ainex/contracts'], { cwd: cfg.webRoot });
    fs.mkdirSync(path.join(cfg.runDir, 'web'), { recursive: true });
    // VITE_API_BASE='' → same-origin /v1 (the preview proxies it); overrides .env.production (api.timeless.uz).
    await runAsync(path.join(cfg.webRoot, 'node_modules', '.bin', 'vite'), ['build', '--outDir', cfg.webDist, '--emptyOutDir', '--logLevel', 'warn'], {
      cwd: cfg.webApp,
      env: { ...baseEnv(), NODE_ENV: 'production', VITE_API_BASE: '', VITE_PUBLIC_WEB_URL: `http://127.0.0.1:${cfg.webPort}`, VITE_MEDIA_BASE: '' },
    });
    log('web build done');
  });
}

async function webStart(cfg) {
  if (!(await portFree(cfg.webPort))) throw new Error(`web port ${cfg.webPort} is already in use`);
  if (!fs.existsSync(path.join(cfg.webDist, 'index.html'))) throw new Error(`${cfg.webDist}/index.html missing — run without --skip-build`);
  fs.mkdirSync(path.join(cfg.runDir, 'web'), { recursive: true });
  const { logPath } = startDetached(cfg, 'web', process.execPath, [path.join(cfg.webRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--config', path.join(HERE, 'preview.config.mjs')], {
    cwd: cfg.webApp,
    env: { ...baseEnv(), E2E_RUN_DIR: cfg.runDir, E2E_WEB_PORT: String(cfg.webPort), E2E_API_PORT: String(cfg.apiPort), E2E_CSP: process.env.E2E_CSP ?? 'on' },
  });
  await waitFor('web preview', async () => {
    const r = await fetch(`http://127.0.0.1:${cfg.webPort}/`);
    return r.ok && (await r.text()).includes('<div id="root"');
  }, 30_000, logPath);
  const h = await fetch(`http://127.0.0.1:${cfg.webPort}/v1/public/design`).catch(() => null);
  log(`web up on http://127.0.0.1:${cfg.webPort} (proxy /v1 → ${cfg.apiPort}: ${h ? h.status : 'unreachable'})`);
}

// ------------------------------------------------------------------------------------------------ commands

function writeStackJson(cfg, extra = {}) {
  const git = (dir) => { try { return spawnSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim(); } catch { return ''; } };
  const data = {
    runDir: cfg.runDir, dbPort: cfg.dbPort, apiPort: cfg.apiPort, webPort: cfg.webPort, socket: cfg.socket,
    baseURL: `http://127.0.0.1:${cfg.webPort}`, apiURL: `http://127.0.0.1:${cfg.apiPort}`,
    db: { host: '127.0.0.1', port: cfg.dbPort, user: DB_USER, password: DB_PASS, database: DB_NAME, socket: cfg.socket },
    apiTree: cfg.apiTree, webTree: cfg.webRoot, apiHead: cfg.apiTree ? git(cfg.apiTree) : '', webHead: git(cfg.webRoot),
    stateDirs: cfg.dirs, updatedAt: new Date().toISOString(), ...extra,
  };
  fs.writeFileSync(path.join(cfg.runDir, 'stack.json'), JSON.stringify(data, null, 2) + '\n');
}

async function down(cfg) {
  let any = false;
  any = (await stopProcess(cfg, 'web')) || any;
  any = (await stopProcess(cfg, 'api')) || any;
  const pid = readPid(cfg, 'mysqld');
  if (pid && alive(pid) && ours(pid, cfg.runDir)) {
    try { run('mysqladmin', [`--socket=${cfg.socket}`, '-uroot', 'shutdown']); } catch { /* fall back to signals */ }
    const until = Date.now() + 30_000;
    while (alive(pid) && Date.now() < until) await sleep(200);
    if (!alive(pid)) { fs.rmSync(pidFile(cfg, 'mysqld'), { force: true }); log(`stopped mysqld (pid ${pid})`); any = true; }
  }
  any = (await stopProcess(cfg, 'mysqld', { graceMs: 30_000 })) || any;
  if (!any) log('nothing running for', cfg.runDir);
}

async function up(cfg) {
  guard(cfg, apiEnv(cfg));
  fs.mkdirSync(cfg.runDir, { recursive: true });
  await down(cfg);
  for (const [name, port] of [['DB', cfg.dbPort], ['API', cfg.apiPort], ['web', cfg.webPort]]) if (!(await portFree(port))) throw new Error(`${name} port ${port} is already in use by another process`);
  const t0 = Date.now();
  writeStackJson(cfg, { state: 'starting' });
  const builds = cfg.skipBuild ? Promise.resolve() : Promise.all([apiBuild(cfg), webBuild(cfg)]);
  try {
    await dbStart(cfg);
    dbLoad(cfg);
    installState(cfg);
    await builds;
    await apiStart(cfg);
    await webStart(cfg);
  } catch (e) {
    await builds.catch(() => undefined);
    log('start failed — stopping what was started');
    await down(cfg);
    throw e;
  }
  writeStackJson(cfg, { state: 'up', seededAt: new Date().toISOString() });
  log(`stack up in ${Math.round((Date.now() - t0) / 1000)}s → ${`http://127.0.0.1:${cfg.webPort}`}  (E2E_RUN_DIR=${cfg.runDir})`);
}

async function reseed(cfg) {
  const prev = readStackJson(cfg.runDir);
  if (!prev || !alive(readPid(cfg, 'mysqld'))) throw new Error('the DB is not running for this run dir — use up');
  guard(cfg, apiEnv(cfg));
  await stopProcess(cfg, 'api');
  dbLoad(cfg);
  installState(cfg);
  await apiStart(cfg);
  writeStackJson(cfg, { state: 'up', seededAt: new Date().toISOString() });
  log('reseeded');
}

async function restartApi(cfg) {
  if (!alive(readPid(cfg, 'mysqld'))) throw new Error('the DB is not running for this run dir — use up');
  guard(cfg, apiEnv(cfg));
  await stopProcess(cfg, 'api');
  if (!cfg.skipBuild) await apiBuild(cfg);
  await apiStart(cfg);
  writeStackJson(cfg, { state: 'up', seededAt: readStackJson(cfg.runDir)?.seededAt });
}

async function rebuildWeb(cfg) {
  guard(cfg, null);
  await stopProcess(cfg, 'web');
  if (!cfg.skipBuild) await webBuild(cfg);
  await webStart(cfg);
  writeStackJson(cfg, { state: 'up', seededAt: readStackJson(cfg.runDir)?.seededAt });
}

async function status(cfg) {
  const s = readStackJson(cfg.runDir);
  const rows = [];
  for (const name of ['mysqld', 'api', 'web']) {
    const pid = readPid(cfg, name);
    rows.push({ name, pid, alive: !!pid && alive(pid) && ours(pid, cfg.runDir) });
  }
  let health = null;
  if (s?.apiPort) health = await fetch(`http://127.0.0.1:${s.apiPort}/health/ready`).then((r) => r.json()).catch(() => null);
  let web = null;
  if (s?.webPort) web = await fetch(`http://127.0.0.1:${s.webPort}/`).then((r) => r.status).catch(() => null);
  console.log(JSON.stringify({ runDir: cfg.runDir, ports: s ? { db: s.dbPort, api: s.apiPort, web: s.webPort } : null, processes: rows, apiHealth: health, webStatus: web, seededAt: s?.seededAt ?? null, baseURL: s?.baseURL ?? null }, null, 2));
  return rows.every((r) => r.alive) && health?.status === 'ready' && web === 200;
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  if (cmd === 'help' || flags.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 21).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }
  const cfg = loadConfig(cmd, flags);
  switch (cmd) {
    case 'up': return up(cfg);
    case 'down': return down(cfg);
    case 'reseed': return reseed(cfg);
    case 'restart-api': return restartApi(cfg);
    case 'rebuild-web': return rebuildWeb(cfg);
    case 'status': { const ok = await status(cfg); process.exitCode = ok ? 0 : 3; return; }
    default: throw new Error(`unknown command ${cmd} (up | down | status | reseed | restart-api | rebuild-web)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('[stack] ERROR:', e.message); process.exit(1); });
}
