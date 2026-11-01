#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { normalizeBiblePayload } from '../server/bible-loader.mjs';

const gzipAsync = promisify(zlib.gzip);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BUILTIN_DIR = path.join(ROOT_DIR, 'data', 'builtin');
const CACHE_DIR = '/tmp/tvbible-raw-cache';

const TRANSLATION_SOURCES = [
  {
    id: 'BSB',
    name: 'Berean Standard Bible',
    shortName: 'BSB',
    license: 'Public Domain (CC0)',
    urls: [
      'https://raw.githubusercontent.com/scrollmapper/bible_databases/refs/heads/master/sources/en/BSB/BSB.json',
      'https://raw.githubusercontent.com/scrollmapper/bible_databases/refs/heads/master/formats/json/BSB.json'
    ]
  },
  {
    id: 'WEB',
    name: 'World English Bible (NHEB)',
    shortName: 'WEB',
    license: 'Public Domain',
    urls: [
      'https://raw.githubusercontent.com/scrollmapper/bible_databases/refs/heads/master/sources/en/NHEB/NHEB.json',
      'https://bolls.life/static/translations/WEB.json'
    ]
  },
  {
    id: 'KJV',
    name: 'King James Version',
    shortName: 'KJV',
    license: 'Public Domain',
    urls: [
      'https://raw.githubusercontent.com/scrollmapper/bible_databases/refs/heads/master/sources/en/KJV/KJV.json',
      'https://raw.githubusercontent.com/scrollmapper/bible_databases/refs/heads/master/formats/json/KJV.json',
      'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json'
    ]
  },
  {
    id: 'ASV',
    name: 'American Standard Version',
    shortName: 'ASV',
    license: 'Public Domain (1901)',
    urls: [
      'https://raw.githubusercontent.com/scrollmapper/bible_databases/refs/heads/master/sources/en/ASV/ASV.json',
      'https://raw.githubusercontent.com/scrollmapper/bible_databases/refs/heads/master/formats/json/ASV.json'
    ]
  }
];

async function fetchFirstAvailable(entry) {
  let lastErr = null;
  for (const url of entry.urls) {
    try {
      console.log(`[fetch] Trying ${entry.id} from ${url} ...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'tvbible-fetcher/1.0' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      // Quick sanity check that it parses as JSON
      JSON.parse(text);
      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`[fetch] Failed ${url}: ${err.message}`);
    }
  }
  throw new Error(`Unable to download ${entry.id}: ${lastErr?.message}`);
}

async function downloadRawToCache() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  for (const entry of TRANSLATION_SOURCES) {
    const cacheFile = path.join(CACHE_DIR, `${entry.id}.raw.json`);
    const jsonText = await fetchFirstAvailable(entry);
    await fs.writeFile(cacheFile, jsonText, 'utf8');
    console.log(`[fetch] Cached ${entry.id} -> ${cacheFile} (${(jsonText.length / 1024 / 1024).toFixed(2)} MB)`);
  }
}

async function buildFromCache() {
  await fs.mkdir(BUILTIN_DIR, { recursive: true });
  for (const entry of TRANSLATION_SOURCES) {
    const cacheFile = path.join(CACHE_DIR, `${entry.id}.raw.json`);
    const rawText = await fs.readFile(cacheFile, 'utf8');
    const rawJson = JSON.parse(rawText);
    const normalized = normalizeBiblePayload(rawJson, {
      id: entry.id,
      name: entry.name,
      shortName: entry.shortName,
      license: entry.license,
      source: 'builtin'
    });

    const bookCount = Object.keys(normalized.books).length;
    let verseCount = 0;
    for (const chapters of Object.values(normalized.books)) {
      for (const verses of Object.values(chapters)) {
        verseCount += verses.length;
      }
    }

    const compact = JSON.stringify(normalized);
    const compressed = await gzipAsync(Buffer.from(compact, 'utf8'), { level: 9 });
    const outPath = path.join(BUILTIN_DIR, `${entry.id}.json.gz`);
    await fs.writeFile(outPath, compressed);
    console.log(
      `[build] Built ${entry.id} (${bookCount} books, ${verseCount} verses) -> ${outPath} (${(
        compressed.length /
        1024 /
        1024
      ).toFixed(2)} MB)`
    );
  }
}

const args = new Set(process.argv.slice(2));
const downloadOnly = args.has('--download-only');
const buildOnly = args.has('--build-from-cache');

if (downloadOnly) {
  await downloadRawToCache();
} else if (buildOnly) {
  await buildFromCache();
} else {
  await downloadRawToCache();
  await buildFromCache();
}
