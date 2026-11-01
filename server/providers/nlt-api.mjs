import { CANON_BOOKS, resolveBook } from '../../public/js/canon.mjs';
import { cleanVerseText } from '../bible-loader.mjs';

const NLT_API_URL = 'https://api.nlt.to/api/passages';
const MAX_CACHE = 500;

export function parseNltHtmlVerses(html) {
  const verses = [];
  const exportRegex = /<verse_export\b([^>]*)>([\s\S]*?)<\/verse_export>/gi;
  let match;
  while ((match = exportRegex.exec(html)) !== null) {
    const attrs = match[1];
    let body = match[2];
    const vNum = Number(attrs.match(/\bvn="(\d+)"/i)?.[1]);
    if (!Number.isFinite(vNum) || vNum < 1) continue;

    // Remove headings, footnote popups, and explicit verse-number spans inside NLT HTML
    body = body
      .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ')
      .replace(/<a\b[^>]*class="[^"]*a-tn[^"]*"[^>]*>[\s\S]*?<\/a>/gi, ' ')
      .replace(/<span\b[^>]*class="[^"]*tn[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ')
      .replace(/<span\b[^>]*class="[^"]*vn[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ');

    const text = cleanVerseText(body);
    if (text) {
      verses.push({ v: vNum, t: text });
    }
  }
  return verses.sort((a, b) => a.v - b.v);
}

export function createNltApiProvider({ apiKey } = {}) {
  if (!apiKey) {
    return {
      enabled: false,
      listTranslations() {
        return [];
      },
      async getChapter() {
        return null;
      }
    };
  }

  const chapterCache = new Map();

  const meta = {
    id: 'NLT',
    name: 'New Living Translation',
    shortName: 'NLT',
    license: 'Licensed via Tyndale NLT API',
    source: 'nlt.api'
  };

  async function getChapter(translationId, bookInput, chapterNum) {
    if (String(translationId).toUpperCase() !== 'NLT') return null;
    const book = resolveBook(bookInput);
    if (!book) return null;

    const cacheKey = `NLT:${book.id}:${chapterNum}`;
    if (chapterCache.has(cacheKey)) {
      return chapterCache.get(cacheKey);
    }

    const refBook = book.name.replace(/\s+/g, '+');
    const url = `${NLT_API_URL}?ref=${refBook}.${Number(chapterNum)}&version=NLT&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`NLT API HTTP ${res.status}`);
    }
    const html = await res.text();
    const verses = parseNltHtmlVerses(html);
    if (verses.length === 0) {
      throw new Error('No verses returned from NLT API');
    }

    if (chapterCache.size >= MAX_CACHE) {
      const oldestKey = chapterCache.keys().next().value;
      chapterCache.delete(oldestKey);
    }
    const result = {
      verses,
      copyright: meta.license,
      booksMeta: CANON_BOOKS
    };
    chapterCache.set(cacheKey, result);
    return result;
  }

  return {
    enabled: true,
    listTranslations() {
      return [meta];
    },
    getChapter
  };
}

