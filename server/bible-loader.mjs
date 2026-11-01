import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { CANON_BOOKS, BOOKS_BY_ID, resolveBook } from '../public/js/canon.mjs';

const gunzipAsync = promisify(zlib.gunzip);

export const KNOWN_TRANSLATION_NAMES = {
  BSB: 'Berean Standard Bible',
  WEB: 'World English Bible',
  KJV: 'King James Version',
  ASV: 'American Standard Version',
  NIV: 'New International Version',
  NKJV: 'New King James Version',
  NKJ: 'New King James Version',
  NLT: 'New Living Translation',
  ESV: 'English Standard Version',
  CSB: 'Christian Standard Bible',
  NASB: 'New American Standard Bible',
  NET: 'New English Translation',
  LSB: 'Legacy Standard Bible',
  YLT: "Young's Literal Translation"
};

/**
 * Clean raw verse text from public-domain or exported datasets.
 */
export function cleanVerseText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/¶/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function addVerse(booksOut, bookInput, chapterNum, verseNum, rawText) {
  const book = resolveBook(bookInput);
  if (!book) return;
  const chapKey = String(Number(chapterNum));
  const vNum = Number(verseNum);
  const cleaned = cleanVerseText(rawText);
  if (!Number.isFinite(vNum) || vNum < 1 || !cleaned) return;

  if (!booksOut[book.id]) {
    booksOut[book.id] = {};
  }
  if (!booksOut[book.id][chapKey]) {
    booksOut[book.id][chapKey] = [];
  }
  booksOut[book.id][chapKey].push({ v: vNum, t: cleaned });
}

function sortAndDedupeBooks(booksOut) {
  for (const bookId of Object.keys(booksOut)) {
    const chapters = booksOut[bookId];
    for (const chapKey of Object.keys(chapters)) {
      const seen = new Map();
      for (const item of chapters[chapKey]) {
        if (seen.has(item.v)) {
          // Some datasets split poetic lines into duplicate verse rows; join cleanly.
          seen.set(item.v, { v: item.v, t: `${seen.get(item.v).t} ${item.t}`.trim() });
        } else {
          seen.set(item.v, item);
        }
      }
      chapters[chapKey] = Array.from(seen.values()).sort((a, b) => a.v - b.v);
    }
  }
  return booksOut;
}

/**
 * Normalize multiple common Bible JSON schemas into a uniform structure:
 * {
 *   id: "BSB",
 *   name: "Berean Standard Bible",
 *   shortName: "BSB",
 *   license: "...",
 *   source: "builtin" | "local",
 *   books: { "GEN": { "1": [{ v: 1, t: "..." }] } }
 * }
 */
export function normalizeBiblePayload(raw, fallbackMeta = {}) {
  const rawId = String(fallbackMeta.id || raw?.id || raw?.abbreviation || raw?.shortName || 'BIBLE')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  const id = rawId || 'BIBLE';
  const name =
    fallbackMeta.name ||
    raw?.name ||
    raw?.translation ||
    raw?.title ||
    raw?.description ||
    KNOWN_TRANSLATION_NAMES[id] ||
    id;
  const shortName = fallbackMeta.shortName || raw?.shortName || raw?.abbreviation || id;
  const license = fallbackMeta.license || raw?.license || raw?.copyright || 'Local / Open Dataset';
  const booksOut = {};

  if (!raw) {
    throw new Error(`Empty Bible payload for ${id}`);
  }

  // Case 1: Array of books (e.g. thiagobodruk/bible: [{ abbrev, name, chapters: [[verses]] }])
  // OR flat array of verse objects ([{ book, chapter, verse, text }])
  if (Array.isArray(raw)) {
    if (raw.length > 0 && Array.isArray(raw[0]?.chapters)) {
      raw.forEach((bookObj, bIdx) => {
        const bookRef = bookObj.id || bookObj.name || bookObj.abbrev || bIdx + 1;
        bookObj.chapters.forEach((chapArr, cIdx) => {
          if (Array.isArray(chapArr)) {
            chapArr.forEach((vItem, vIdx) => {
              if (typeof vItem === 'string') {
                addVerse(booksOut, bookRef, cIdx + 1, vIdx + 1, vItem);
              } else if (vItem && typeof vItem === 'object') {
                addVerse(booksOut, bookRef, cIdx + 1, vItem.v ?? vItem.verse ?? vIdx + 1, vItem.t ?? vItem.text);
              }
            });
          }
        });
      });
    } else {
      for (const row of raw) {
        addVerse(
          booksOut,
          row.book_id ?? row.book_name ?? row.book ?? row.b,
          row.chapter ?? row.c,
          row.verse ?? row.v,
          row.text ?? row.t
        );
      }
    }
  }
  // Case 2: scrollmapper 2024/2025 ({ translation, books: [{ name, chapters: [{ chapter, verses: [{ verse, text }] }] }] })
  else if (Array.isArray(raw.books)) {
    raw.books.forEach((bookObj, bIdx) => {
      const bookRef = bookObj.id || bookObj.name || bookObj.abbrev || bIdx + 1;
      const chapters = bookObj.chapters || [];
      chapters.forEach((chapObj, cIdx) => {
        if (Array.isArray(chapObj)) {
          chapObj.forEach((vItem, vIdx) => {
            if (typeof vItem === 'string') {
              addVerse(booksOut, bookRef, cIdx + 1, vIdx + 1, vItem);
            } else {
              addVerse(booksOut, bookRef, cIdx + 1, vItem.v ?? vItem.verse ?? vIdx + 1, vItem.t ?? vItem.text);
            }
          });
        } else if (chapObj && typeof chapObj === 'object') {
          const chapNum = chapObj.chapter ?? chapObj.number ?? cIdx + 1;
          const verses = chapObj.verses || [];
          if (Array.isArray(verses)) {
            verses.forEach((vObj, vIdx) => {
              addVerse(booksOut, bookRef, chapNum, vObj.verse ?? vObj.v ?? vIdx + 1, vObj.text ?? vObj.t);
            });
          } else if (typeof verses === 'object') {
            for (const [vKey, vVal] of Object.entries(verses)) {
              addVerse(booksOut, bookRef, chapNum, vKey, typeof vVal === 'string' ? vVal : vVal?.text ?? vVal?.t);
            }
          }
        }
      });
    });
  }
  // Case 3: Legacy scrollmapper ({ resultset: { row: [{ field: [id, b, c, v, text] }] } })
  else if (Array.isArray(raw?.resultset?.row)) {
    for (const entry of raw.resultset.row) {
      const f = entry.field;
      if (Array.isArray(f) && f.length >= 5) {
        addVerse(booksOut, Number(f[1]), Number(f[2]), Number(f[3]), f[4]);
      }
    }
  }
  // Case 4: Wrapped flat verses ({ metadata, verses: [{ book_name, book, chapter, verse, text }] })
  else if (Array.isArray(raw.verses)) {
    for (const row of raw.verses) {
      addVerse(
        booksOut,
        row.book_name ?? row.book ?? row.book_id ?? row.b,
        row.chapter ?? row.c,
        row.verse ?? row.v,
        row.text ?? row.t
      );
    }
  }
  // Case 5: Normalized or keyed object ({ books: { GEN: { "1": [...] } } } OR { "Genesis": { "1": { "1": "..." } } })
  else if (typeof raw === 'object') {
    const booksContainer = raw.books && typeof raw.books === 'object' ? raw.books : raw;
    for (const [bookKey, chapMap] of Object.entries(booksContainer)) {
      if (!chapMap || typeof chapMap !== 'object') continue;
      const resolved = resolveBook(bookKey);
      if (!resolved) continue;

      if (Array.isArray(chapMap)) {
        chapMap.forEach((chapVal, cIdx) => {
          const chapNum = cIdx + 1;
          if (Array.isArray(chapVal)) {
            chapVal.forEach((vVal, vIdx) => {
              if (typeof vVal === 'string') {
                addVerse(booksOut, resolved.id, chapNum, vIdx + 1, vVal);
              } else if (vVal && typeof vVal === 'object') {
                addVerse(booksOut, resolved.id, chapNum, vVal.v ?? vVal.verse ?? vIdx + 1, vVal.t ?? vVal.text);
              }
            });
          }
        });
      } else {
        for (const [chapKey, versesContainer] of Object.entries(chapMap)) {
          const chapNum = Number(chapKey);
          if (!Number.isFinite(chapNum) || chapNum < 1) continue;
          if (Array.isArray(versesContainer)) {
            versesContainer.forEach((vVal, vIdx) => {
              if (typeof vVal === 'string') {
                addVerse(booksOut, resolved.id, chapNum, vIdx + 1, vVal);
              } else if (vVal && typeof vVal === 'object') {
                addVerse(booksOut, resolved.id, chapNum, vVal.v ?? vVal.verse ?? vIdx + 1, vVal.t ?? vVal.text);
              }
            });
          } else if (versesContainer && typeof versesContainer === 'object') {
            for (const [vKey, vVal] of Object.entries(versesContainer)) {
              addVerse(
                booksOut,
                resolved.id,
                chapNum,
                Number(vKey),
                typeof vVal === 'string' ? vVal : vVal?.t ?? vVal?.text
              );
            }
          }
        }
      }
    }
  }

  sortAndDedupeBooks(booksOut);

  const bookCount = Object.keys(booksOut).length;
  if (bookCount === 0) {
    throw new Error(`Could not recognize any canonical Bible books in payload for "${id}"`);
  }

  return {
    id,
    name,
    shortName,
    license,
    source: fallbackMeta.source || 'local',
    books: booksOut
  };
}

/**
 * Load a `.json` or `.json.gz` Bible file from disk and normalize it.
 */
export async function loadBibleFile(filePath, fallbackMeta = {}) {
  const baseName = path.basename(filePath).replace(/\.json(\.gz)?$/i, '');
  const buf = await fs.readFile(filePath);
  const jsonBytes = filePath.toLowerCase().endsWith('.gz') ? await gunzipAsync(buf) : buf;
  const raw = JSON.parse(jsonBytes.toString('utf8'));
  return normalizeBiblePayload(raw, {
    id: baseName.toUpperCase(),
    ...fallbackMeta
  });
}

/**
 * Build canonical book metadata tailored to a loaded translation (chapter counts).
 */
export function buildTranslationBookList(bible) {
  const list = [];
  for (const canon of CANON_BOOKS) {
    const bookData = bible.books[canon.id];
    if (!bookData) continue;
    const chapNums = Object.keys(bookData)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 1);
    const maxChap = chapNums.length > 0 ? Math.max(...chapNums) : canon.chapters;
    list.push({
      index: canon.index,
      id: canon.id,
      name: canon.name,
      shortName: canon.shortName,
      testament: canon.testament,
      chapters: maxChap
    });
  }
  return list;
}

