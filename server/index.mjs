import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  CANON_BOOKS,
  resolveBook,
  getNextChapterRef,
  getPrevChapterRef
} from '../public/js/canon.mjs';
import { loadBibleFile, buildTranslationBookList } from './bible-loader.mjs';
import { createApiBibleProvider } from './providers/api-bible.mjs';
import { createNltApiProvider } from './providers/nlt-api.mjs';

const gzipAsync = promisify(zlib.gzip);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Load local .env automatically if present (Node 21.7+ / 22+)
try {
  process.loadEnvFile?.(path.join(ROOT_DIR, '.env'));
} catch {
  // Ignore when .env does not exist
}

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DEFAULT_BUILTIN_DIR = path.join(ROOT_DIR, 'data', 'builtin');

const PREFERRED_ORDER = ['NIV', 'NLT', 'NKJV', 'BSB', 'WEB', 'KJV', 'ASV'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function isBibleJsonFile(fileName) {
  const lower = fileName.toLowerCase();
  return (lower.endsWith('.json') || lower.endsWith('.json.gz')) && !lower.startsWith('.');
}

export async function createBibleApp(options = {}) {
  const builtinDir = options.builtinDir || DEFAULT_BUILTIN_DIR;
  const apiBible = createApiBibleProvider({
    apiKey: options.apiBibleKey ?? process.env.API_BIBLE_KEY ?? '',
    customIds: options.apiBibleIds ?? process.env.API_BIBLE_IDS ?? '',
    baseUrl: options.apiBibleBaseUrl ?? process.env.API_BIBLE_BASE_URL ?? 'https://rest.api.bible/v1',
    fetchImpl: options.fetchImpl
  });
  const nltApi = createNltApiProvider({
    apiKey: options.nltApiKey ?? process.env.NLT_API_KEY ?? ''
  });

  // Load built-in open-source translations once at startup
  const builtinBibles = new Map();
  try {
    const entries = await fs.readdir(builtinDir);
    for (const file of entries.filter(isBibleJsonFile)) {
      const fullPath = path.join(builtinDir, file);
      const bible = await loadBibleFile(fullPath, { source: 'builtin' });
      bible.booksMeta = buildTranslationBookList(bible);
      builtinBibles.set(bible.id, bible);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[server] Failed reading builtin translations:', err.message);
    }
  }

  async function getAllTranslationsSummary() {
    const merged = new Map();

    for (const [id, b] of builtinBibles.entries()) {
      merged.set(id, {
        id: b.id,
        name: b.name,
        shortName: b.shortName,
        license: b.license,
        source: b.source
      });
    }

    const [apiBibleList, nltList] = await Promise.all([
      apiBible.listTranslations(),
      Promise.resolve(nltApi.listTranslations())
    ]);
    for (const item of [...apiBibleList, ...nltList]) {
      if (!merged.has(item.id)) {
        merged.set(item.id, {
          id: item.id,
          name: item.name,
          shortName: item.shortName,
          license: item.license,
          source: item.source
        });
      }
    }

    return Array.from(merged.values()).sort((a, b) => {
      const idxA = PREFERRED_ORDER.indexOf(a.id);
      const idxB = PREFERRED_ORDER.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id.localeCompare(b.id);
    });
  }

  async function sendJson(req, res, statusCode, payload, cacheHeader = 'no-cache') {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheHeader
    };

    if (body.length > 1024 && acceptEncoding.includes('gzip')) {
      const gz = await gzipAsync(body);
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = gz.length;
      res.writeHead(statusCode, headers);
      res.end(gz);
      return;
    }

    headers['Content-Length'] = body.length;
    res.writeHead(statusCode, headers);
    res.end(body);
  }

  async function serveStatic(req, res, pathname) {
    const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const resolved = path.resolve(PUBLIC_DIR, relPath);
    if (!resolved.startsWith(PUBLIC_DIR + path.sep) && resolved !== path.join(PUBLIC_DIR, 'index.html')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    try {
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const etag = `W/"${stat.size}-${Math.trunc(stat.mtimeMs)}"`;

      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        res.end();
        return;
      }

      const raw = await fs.readFile(resolved);
      const acceptEncoding = String(req.headers['accept-encoding'] || '');
      const compressible = /\.(html|css|m?js|json|svg)$/.test(ext);
      const headers = {
        'Content-Type': contentType,
        ETag: etag,
        'Cache-Control': 'public, max-age=60'
      };

      if (compressible && raw.length > 1024 && acceptEncoding.includes('gzip')) {
        const gz = await gzipAsync(raw);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = gz.length;
        res.writeHead(200, headers);
        res.end(gz);
        return;
      }

      headers['Content-Length'] = raw.length;
      res.writeHead(200, headers);
      res.end(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    }
  }

  const requestListener = async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const { pathname } = url;

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return sendJson(req, res, 405, { error: 'Method Not Allowed' });
      }

      if (pathname === '/api/health') {
        const translations = await getAllTranslationsSummary();
        return sendJson(req, res, 200, {
          status: 'ok',
          uptimeSeconds: Math.round(process.uptime()),
          translationCount: translations.length,
          translations: translations.map((t) => t.id)
        });
      }

      if (pathname === '/api/translations') {
        const translations = await getAllTranslationsSummary();
        return sendJson(req, res, 200, { translations });
      }

      const booksMatch = pathname.match(/^\/api\/books\/([^/]+)$/);
      if (booksMatch) {
        const rawTransId = decodeURIComponent(booksMatch[1]).toUpperCase();
        const transId = rawTransId === 'NKJ' ? 'NKJV' : rawTransId;
        const builtin = builtinBibles.get(transId);
        if (builtin) {
          return sendJson(req, res, 200, {
            translation: builtin.id,
            books: builtin.booksMeta
          }, 'public, max-age=300');
        }
        // Check cloud providers
        const translations = await getAllTranslationsSummary();
        const cloud = translations.find((t) => t.id === transId);
        if (cloud) {
          return sendJson(req, res, 200, {
            translation: cloud.id,
            books: CANON_BOOKS.map(({ index, id, name, shortName, testament, chapters }) => ({
              index,
              id,
              name,
              shortName,
              testament,
              chapters
            }))
          }, 'public, max-age=300');
        }
        return sendJson(req, res, 404, { error: `Unknown translation: ${rawTransId}` });
      }

      const chapMatch = pathname.match(/^\/api\/chapter\/([^/]+)\/([^/]+)\/(\d+)$/);
      if (chapMatch) {
        const rawTransId = decodeURIComponent(chapMatch[1]).toUpperCase();
        const transId = rawTransId === 'NKJ' ? 'NKJV' : rawTransId;
        const bookObj = resolveBook(decodeURIComponent(chapMatch[2]));
        const chapNum = Number(chapMatch[3]);

        if (!bookObj) {
          return sendJson(req, res, 404, { error: `Unknown book: ${chapMatch[2]}` });
        }

        const builtin = builtinBibles.get(transId);
        if (builtin) {
          const verses = builtin.books[bookObj.id]?.[String(chapNum)];
          if (!verses || verses.length === 0) {
            return sendJson(req, res, 404, {
              error: `Chapter not found: ${builtin.id} ${bookObj.name} ${chapNum}`
            });
          }
          const bookMeta = builtin.booksMeta.find((b) => b.id === bookObj.id) || bookObj;
          return sendJson(
            req,
            res,
            200,
            {
              translation: builtin.id,
              translationName: builtin.name,
              license: builtin.license,
              book: bookObj.id,
              bookName: bookObj.name,
              chapter: chapNum,
              totalChapters: bookMeta.chapters,
              prev: getPrevChapterRef(bookObj.id, chapNum, builtin.booksMeta),
              next: getNextChapterRef(bookObj.id, chapNum, builtin.booksMeta),
              verses
            },
            'public, max-age=300'
          );
        }

        // Cloud API providers (API.Bible first, with resilient fallback to NLT API if configured)
        let cloudChapter = null;
        if (apiBible.enabled) {
          try {
            cloudChapter = await apiBible.getChapter(transId, bookObj.id, chapNum);
          } catch (apiErr) {
            if (!(transId === 'NLT' && nltApi.enabled)) {
              throw apiErr;
            }
            console.warn(`[tvbible] API.Bible NLT lookup failed (${apiErr.message}), falling back to NLT_API_KEY`);
          }
        }
        if (!cloudChapter && transId === 'NLT' && nltApi.enabled) {
          cloudChapter = await nltApi.getChapter('NLT', bookObj.id, chapNum);
        }

        if (cloudChapter && cloudChapter.verses.length > 0) {
          return sendJson(
            req,
            res,
            200,
            {
              translation: cloudChapter.id || transId,
              translationName: cloudChapter.name || transId,
              license: cloudChapter.copyright,
              book: bookObj.id,
              bookName: bookObj.name,
              chapter: chapNum,
              totalChapters: bookObj.chapters,
              prev: getPrevChapterRef(bookObj.id, chapNum, CANON_BOOKS),
              next: getNextChapterRef(bookObj.id, chapNum, CANON_BOOKS),
              verses: cloudChapter.verses
            },
            'private, max-age=120'
          );
        }

        return sendJson(req, res, 404, {
          error: `Chapter unavailable for ${rawTransId} ${bookObj.name} ${chapNum}`
        });
      }

      return serveStatic(req, res, pathname);
    } catch (err) {
      console.error('[server] Request error:', err);
      return sendJson(req, res, 500, { error: 'Internal Server Error' });
    }
  };

  const server = http.createServer(requestListener);

  /**
   * Lightweight in-process HTTP request helper for fast, socket-free integration tests.
   */
  async function inject(urlPath, { method = 'GET', headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let statusCode = 200;
      let resHeaders = {};
      const req = { method, url: urlPath, headers: { host: 'localhost', ...headers } };
      const res = {
        writeHead(code, hdrs = {}) {
          statusCode = code;
          resHeaders = { ...hdrs };
        },
        end(chunk) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          const bodyBuffer = Buffer.concat(chunks);
          resolve({
            status: statusCode,
            headers: resHeaders,
            bodyBuffer,
            text: () => bodyBuffer.toString('utf8'),
            json: () => JSON.parse(bodyBuffer.toString('utf8'))
          });
        }
      };
      requestListener(req, res).catch(reject);
    });
  }

  return { server, inject, getAllTranslationsSummary };
}

// Run directly when executed as main module
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 3003);
  const host = process.env.HOST || '0.0.0.0';
  const { server, getAllTranslationsSummary } = await createBibleApp();
  const list = await getAllTranslationsSummary();

  server.listen(port, host, () => {
    console.log(
      `[tvbible] Listening on http://${host}:${port} — Available translations: ${list
        .map((t) => `${t.id} (${t.source})`)
        .join(', ')}`
    );
  });

  const shutdown = (signal) => {
    console.log(`[tvbible] Received ${signal}, shutting down gracefully...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
