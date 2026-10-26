// Unit tests for the stack launcher's guard (no processes started): node --test e2e/stack.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apiEnv, guard, realish } from './stack.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-guard-'));
const cfgFor = (runDir, ports = {}) => {
  const state = path.join(runDir, 'state');
  return {
    runDir, dbPort: 33331, apiPort: 3131, webPort: 5191, ...ports, apiTree: null, webRoot: path.join(tmp, 'web'), webApp: path.join(tmp, 'web', 'apps', 'web'),
    dirs: { TRAFFIC_STATE_DIR: `${state}/traffic`, MEDIA_DIR: `${state}/media`, DESIGN_STORE_DIR: `${state}/design`, HLS_STATE_DIR: `${state}/hls-state`, HLS_ROOT: `${state}/contents-hls`, HLS_CONTENTS_ROOT: `${state}/contents`, HRDE_UPLOAD_DIR: `${state}/upload` },
  };
};
const run = path.join(tmp, 'run');

test('a run folder with its own ports passes', () => {
  const cfg = cfgFor(run);
  assert.doesNotThrow(() => guard(cfg, apiEnv(cfg)));
});

test('every live state dir and the traffic sampler are pinned by apiEnv', () => {
  const env = apiEnv(cfgFor(run));
  for (const k of ['TRAFFIC_STATE_DIR', 'MEDIA_DIR', 'DESIGN_STORE_DIR', 'HLS_STATE_DIR', 'HLS_ROOT', 'HLS_CONTENTS_ROOT', 'HRDE_UPLOAD_DIR', 'ROLLOUT_FLAGS_FILE']) assert.ok(env[k].startsWith(run + '/'), k);
  assert.equal(env.TRAFFIC_MONITOR, 'false');
  assert.equal(env.DB_HOST, '127.0.0.1');
  assert.equal(env.API_WRITE_MODE, 'full');
});

for (const port of [3100, 33306, 3199, 4173]) {
  test(`port ${port} is refused`, () => {
    const cfg = cfgFor(run, { apiPort: port });
    assert.throws(() => guard(cfg, apiEnv(cfg)), /belongs to someone else/);
  });
}

test('duplicate ports are refused', () => {
  const cfg = cfgFor(run, { webPort: 3131 });
  assert.throws(() => guard(cfg, apiEnv(cfg)), /distinct/);
});

for (const root of ['/var/lib/ainex', '/vod', '/web', '/opt', '/etc', '/var/www']) {
  test(`a run dir under ${root} is refused`, () => {
    const cfg = cfgFor(`${root}/e2e-run`);
    assert.throws(() => guard(cfg, apiEnv(cfg)), /resolves under/);
  });
}

test('an E2E_API_* override pointing a state dir at live paths is refused', () => {
  process.env.E2E_API_HLS_ROOT = '/vod/hls';
  process.env.E2E_API_LEGACY_HTML_DIR = '/web/hrde/html';
  try {
    const cfg = cfgFor(run);
    assert.throws(() => guard(cfg, apiEnv(cfg)), (e) => /HLS_ROOT=\/vod\/hls resolves under \/vod/.test(e.message) && /LEGACY_HTML_DIR=\/web\/hrde\/html/.test(e.message));
  } finally {
    delete process.env.E2E_API_HLS_ROOT;
    delete process.env.E2E_API_LEGACY_HTML_DIR;
  }
});

test('DB_HOST / TRAFFIC_MONITOR overrides are refused', () => {
  process.env.E2E_API_DB_HOST = '192.168.11.15';
  process.env.E2E_API_TRAFFIC_MONITOR = 'true';
  try {
    const cfg = cfgFor(run);
    assert.throws(() => guard(cfg, apiEnv(cfg)), (e) => /DB_HOST=192\.168\.11\.15/.test(e.message) && /TRAFFIC_MONITOR must be false/.test(e.message));
  } finally {
    delete process.env.E2E_API_DB_HOST;
    delete process.env.E2E_API_TRAFFIC_MONITOR;
  }
});

test('a symlink into a live path is resolved and refused', () => {
  const link = path.join(tmp, 'sneaky');
  fs.symlinkSync('/etc', link);
  const cfg = cfgFor(path.join(link, 'run'));
  assert.equal(realish(path.join(link, 'run')), '/etc/run');
  assert.throws(() => guard(cfg, apiEnv(cfg)), /resolves under \/etc/);
});

test('building into a protected tree is refused', () => {
  const cfg = { ...cfgFor(run), apiTree: '/root/archive-new/new-codebase' };
  assert.throws(() => guard(cfg, apiEnv(cfg)), /protected tree \/root\/archive-new/);
});
