import { CANON_BOOKS, resolveBook } from '../../public/js/canon.mjs';
import { cleanVerseText, KNOWN_TRANSLATION_NAMES } from '../bible-loader.mjs';

const DEFAULT_API_BASE = 'https://rest.api.bible/v1';
const MAX_CACHE = 500;

function normalizeApiBaseUrl(rawUrl) {
  const trimmed = String(rawUrl || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
  return /\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function normalizeApiBibleCode(rawAbbr) {
  const code = String(rawAbbr || '')
    .trim()
    .replace(/^eng[-_]?/i, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (/^NIV\d*$/.test(code)) return 'NIV';
  if (/^NKJV?\d*$/.test(code)) return 'NKJV';
  if (/^NLT\d*$/.test(code)) return 'NLT';
  if (/^ESV\d*$/.test(code)) return 'ESV';
  if (/^CSB\d*$/.test(code)) return 'CSB';
  if (/^NASB\d*$/.test(code)) return 'NASB';
  return code;
}

function parseVerseNumberFromAttrs(node) {
  if (node.attrs?.number) {
    const n = Number(String(node.attrs.number).match(/\d+/)?.[0]);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  if (node.attrs?.sid) {
    const m = String(node.attrs.sid).match(/:(\d+)\b/);
    if (m) return Number(m[1]);
  }
  if (node.attrs?.verseId) {
    const m = String(node.attrs.verseId).match(/\.(\d+)$/);
    if (m) return Number(m[1]);
  }
  const inlineText =
    typeof node.text === 'string'
      ? node.text
      : Array.isArray(node.items)
        ? node.items.map((i) => i.text || '').join('')
        : '';
  const n = Number(inlineText.trim().match(/^(\d+)/)?.[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function extractVersesFromApiBibleJson(nodes, acc = new Map(), state = { currentVerse: 0 }) {
  if (!Array.isArray(nodes)) return acc;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;

    if (node.name === 'verse' || node.attrs?.style === 'v') {
      const vNum = parseVerseNumberFromAttrs(node);
      if (vNum) {
        state.currentVerse = vNum;
        if (!acc.has(vNum)) acc.set(vNum, '');
      }
      continue;
    }

    if (
      node.name === 'note' ||
      (node.attrs?.style && /^(f|fe|x|s\d*|ms\d*|mr|r|sp|cl|cp|qa)$/.test(node.attrs.style))
    ) {
      continue;
    }

    if (node.attrs?.verseId || node.attrs?.sid) {
      const vNum = parseVerseNumberFromAttrs(node);
      if (vNum) {
        state.currentVerse = vNum;
        if (!acc.has(vNum)) acc.set(vNum, '');
      }
    }

    if (typeof node.text === 'string') {
      const targetV = state.currentVerse || 1;
      acc.set(targetV, `${acc.get(targetV) || ''}${node.text}`);
    }

    if (Array.isArray(node.items)) {
      extractVersesFromApiBibleJson(node.items, acc, state);
      if (node.name === 'para' || /^q\d*$/.test(node.attrs?.style || '')) {
        const targetV = state.currentVerse;
        if (targetV && acc.has(targetV)) {
          acc.set(targetV, `${acc.get(targetV)} `);
        }
      }
    }
  }
  return acc;
}

export function createApiBibleProvider({
  apiKey,
  customIds = '',
  baseUrl = DEFAULT_API_BASE,
  fetchImpl = globalThis.fetch
} = {}) {
  const apiBase = normalizeApiBaseUrl(baseUrl);
  if (!apiKey) {
    return {
      enabled: false,
      async listTranslations() {
        return [];
      },
      async getChapter() {
        return null;
      }
    };
  }

  const chapterCache = new Map();
  let cachedBibles = null;
  let cachedAt = 0;

  // Optional explicit mapping e.g. "NIV:78a9f6124f344018-01,NKJV:de4e12af7f28f599-02"
  const explicitMap = new Map();
  for (const pair of String(customIds).split(',').map((s) => s.trim()).filter(Boolean)) {
    const [abbr, bibleId] = pair.split(':').map((s) => s.trim());
    if (abbr && bibleId) {
      explicitMap.set(normalizeApiBibleCode(abbr), bibleId);
    }
  }

  async function discoverBibles() {
    // When explicit API_BIBLE_IDS are configured in .env, use that exact curated set directly
    if (explicitMap.size > 0) {
      return Array.from(explicitMap.entries()).map(([abbr, bibleId]) => ({
        id: abbr,
        bibleId,
        name: KNOWN_TRANSLATION_NAMES[abbr] || abbr,
        shortName: abbr,
        license: 'Licensed via API.Bible',
        source: 'api.bible'
      }));
    }

    const now = Date.now();
    if (cachedBibles && now - cachedAt < 3600_000) {
      return cachedBibles;
    }
    try {
      const res = await fetchImpl(`${apiBase}/bibles?language=eng`, {
        headers: { 'api-key': apiKey, Accept: 'application/json' }
      });
      if (!res.ok) throw new Error(`API.Bible HTTP ${res.status}`);
      const json = await res.json();
      const targetAbbrs = new Set(['NIV', 'NKJV', 'NLT', 'ESV', 'CSB', 'NASB']);
      const discovered = new Map();

      for (const b of json?.data || []) {
        if (b.type && b.type !== 'text') continue;
        const abbr = normalizeApiBibleCode(b.abbreviationLocal || b.abbreviation || b.id);
        if (!abbr || !targetAbbrs.has(abbr)) continue;
        if (!discovered.has(abbr)) {
          discovered.set(abbr, {
            id: abbr,
            bibleId: b.id,
            name: b.nameLocal || b.name || KNOWN_TRANSLATION_NAMES[abbr] || abbr,
            shortName: abbr,
            license: 'Licensed via API.Bible',
            source: 'api.bible'
          });
        }
      }

      cachedBibles = Array.from(discovered.values());
      cachedAt = now;
      return cachedBibles;
    } catch (err) {
      console.warn('[api.bible] Discovery failed:', err.message);
      return cachedBibles || [];
    }
  }

  async function getChapter(translationId, bookInput, chapterNum) {
    const normalizedId = normalizeApiBibleCode(translationId);
    const list = await discoverBibles();
    const meta = list.find((t) => t.id === normalizedId);
    if (!meta) return null;

    const book = resolveBook(bookInput);
    if (!book) return null;

    const cacheKey = `${meta.bibleId}:${book.id}:${chapterNum}`;
    if (chapterCache.has(cacheKey)) {
      return chapterCache.get(cacheKey);
    }

    const url = `${apiBase}/bibles/${encodeURIComponent(meta.bibleId)}/chapters/${book.id}.${Number(
      chapterNum
    )}?content-type=json&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`;
    const res = await fetchImpl(url, {
      headers: { 'api-key': apiKey, Accept: 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`API.Bible chapter HTTP ${res.status}`);
    }
    const payload = await res.json();
    const verseMap = extractVersesFromApiBibleJson(payload?.data?.content || []);
    const verses = Array.from(verseMap.entries())
      .map(([v, rawText]) => ({ v, t: cleanVerseText(rawText) }))
      .filter((item) => item.t.length > 0)
      .sort((a, b) => a.v - b.v);

    if (chapterCache.size >= MAX_CACHE) {
      const oldestKey = chapterCache.keys().next().value;
      chapterCache.delete(oldestKey);
    }
    const result = {
      id: meta.id,
      name: meta.name,
      verses,
      copyright: payload?.data?.copyright || meta.license,
      booksMeta: CANON_BOOKS
    };
    chapterCache.set(cacheKey, result);
    return result;
  }

  return {
    enabled: true,
    listTranslations: discoverBibles,
    getChapter
  };
}

