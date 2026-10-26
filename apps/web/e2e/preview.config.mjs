// Vite preview config for the e2e stack (started by e2e/stack.mjs — never by hand).
// Serves the SPA build from <run>/web-dist, proxies /v1 to the local e2e API and serves the same-origin media folders the
// production vhost aliases (/usr/local/apache/conf/extra/timeless/20-timeless-https.conf):
//   /contents/ → <run>/state/contents   (prod /vod/contents)       /upload/ → <run>/state/upload   (prod /vod/upload)
//   /media/    → <run>/state/media      (prod /var/lib/ainex/media)  /contents-hls/ → <run>/state/contents-hls
// Media paths are real files only (404, never the SPA fallback), with byte ranges for <video> seeking, and the production
// security headers (CSP adapted to http://127.0.0.1: same-origin API, no upgrade-insecure-requests). E2E_CSP=off drops CSP.
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const RUN_DIR = process.env.E2E_RUN_DIR;
const WEB_PORT = Number(process.env.E2E_WEB_PORT);
const API_PORT = Number(process.env.E2E_API_PORT);
if (!RUN_DIR || !WEB_PORT || !API_PORT) throw new Error('preview.config.mjs is started by e2e/stack.mjs (E2E_RUN_DIR, E2E_WEB_PORT, E2E_API_PORT)');

const STATE = path.join(RUN_DIR, 'state');
const MOUNTS = [
  { prefix: '/contents-hls/', dir: path.join(STATE, 'contents-hls'), deny: /\.(php|phtml|phar|cgi|pl|sh|json|tmp)$/i, kind: 'hls' },
  { prefix: '/contents/', dir: path.join(STATE, 'contents'), deny: /\.(php|phtml|phar|cgi|pl|sh)$/i, kind: 'contents' },
  { prefix: '/upload/', dir: path.join(STATE, 'upload'), deny: /\.(php|phtml|phar|cgi|pl|sh)$/i, kind: 'inert' },
  { prefix: '/media/', dir: path.join(STATE, 'media'), deny: /\.(php|phtml|phar|cgi|pl|sh)$/i, kind: 'inert' },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.vtt': 'text/vtt; charset=utf-8',
  '.mp4': 'video/mp4', '.m4s': 'video/mp4', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.hwp': 'application/x-hwp', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const CSP_ON = (process.env.E2E_CSP ?? 'on') !== 'off';
// Production values with the two host-specific parts adapted: connect-src/form-action 'self' (the API is same-origin here)
// and no upgrade-insecure-requests (the e2e origin is plain http).
const CDN = 'https://d2bkvpco60wou2.cloudfront.net';
const SPA_CSP = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob: ${CDN}; connect-src 'self' ${CDN}; worker-src 'self' blob:; object-src 'none'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://nice.checkplus.co.kr`;
const CONTENTS_CSP = `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob:; media-src 'self' blob: ${CDN}; connect-src 'self' ${CDN}; object-src 'none'; frame-ancestors 'self'`;
const INERT_CSP = "default-src 'none'; sandbox";

function securityHeaders(res, kind) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (!CSP_ON) return;
  res.setHeader('Content-Security-Policy', kind === 'contents' ? CONTENTS_CSP : kind === 'inert' ? INERT_CSP : SPA_CSP);
}

/** Resolves a request path inside `dir`; null for anything that escapes it. */
function inside(dir, rel) {
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const full = path.resolve(dir, '.' + path.posix.normalize('/' + decoded));
  return full === dir || full.startsWith(dir + path.sep) ? full : null;
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.end(body);
}

/** Static file with single byte-range support (what <video> and hls.js ask for). */
function serveFile(req, res, mount, urlPath) {
  const rel = urlPath.slice(mount.prefix.length);
  const full = inside(mount.dir, rel);
  if (!full) return send(res, 400, 'Bad request');
  if (mount.deny.test(full)) return send(res, 403, 'Forbidden');
  let st;
  try { st = fs.statSync(full); } catch { return send(res, 404, 'Not Found'); }
  if (!st.isFile()) return send(res, 404, 'Not Found'); // no directory listing (Options -Indexes)
  const type = TYPES[path.extname(full).toLowerCase()] ?? 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', mount.kind === 'hls' ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
  res.setHeader('Last-Modified', st.mtime.toUTCString());
  let start = 0;
  let end = st.size - 1;
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (!m || (m[1] === '' && m[2] === '')) { res.setHeader('Content-Range', `bytes */${st.size}`); return send(res, 416, 'Range Not Satisfiable'); }
    if (m[1] === '') { start = Math.max(0, st.size - Number(m[2])); }
    else { start = Number(m[1]); if (m[2] !== '') end = Math.min(end, Number(m[2])); }
    if (start > end || start >= st.size) { res.setHeader('Content-Range', `bytes */${st.size}`); return send(res, 416, 'Range Not Satisfiable'); }
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
  } else {
    res.statusCode = 200;
  }
  res.setHeader('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(full, { start, end }).on('error', () => res.destroy()).pipe(res);
}

function e2eMedia() {
  return {
    name: 'ainex-e2e-media',
    configurePreviewServer(server) {
      // Runs before Vite's own static/SPA-fallback middlewares.
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url ?? '/').split('?')[0];
        const mount = MOUNTS.find((m) => urlPath.startsWith(m.prefix));
        securityHeaders(res, mount?.kind ?? 'spa');
        if (urlPath === '/index.html' || urlPath === '/' || !path.extname(urlPath)) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        if (!mount) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
        return serveFile(req, res, mount, urlPath);
      });
    },
  };
}

export default defineConfig({
  plugins: [e2eMedia()],
  // No .env files: the build already happened with the e2e values (stack.mjs).
  envDir: path.join(RUN_DIR, 'web'),
  build: { outDir: path.join(RUN_DIR, 'web-dist') },
  preview: {
    host: '127.0.0.1',
    port: WEB_PORT,
    strictPort: true,
    // The API is same-origin here (prod: api.timeless.uz). X-Forwarded-For sent by the test browser passes through untouched,
    // so the API's req.ip (trust proxy 1) is the per-test address the e2e fixtures set (spreads the 120/min throttle).
    proxy: { '/v1': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: true } },
  },
  logLevel: 'info',
  clearScreen: false,
});
