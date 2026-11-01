import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANON_BOOKS,
  resolveBook,
  getNextChapterRef,
  getPrevChapterRef
} from '../public/js/canon.mjs';
import { packVersesIntoSpreads, findSpreadIndexForVerse } from '../public/js/paginator.mjs';
import { pickSpatialCandidate } from '../public/js/spatial-nav.mjs';
import { normalizeBiblePayload } from '../server/bible-loader.mjs';
import { createApiBibleProvider } from '../server/providers/api-bible.mjs';
import { parseNltHtmlVerses } from '../server/providers/nlt-api.mjs';
import { createBibleApp } from '../server/index.mjs';

test('Canonical 66 books and explicit chapter/book boundary transitions', () => {
  assert.equal(CANON_BOOKS.length, 66);
  assert.equal(resolveBook('John')?.id, 'JHN');
  assert.equal(resolveBook('1 Corinthians')?.id, '1CO');
  assert.equal(resolveBook('ii samuel')?.id, '2SA');
  assert.equal(resolveBook(66)?.id, 'REV');

  // Mid-book next/prev chapter
  assert.deepEqual(getNextChapterRef('JHN', 3), { book: 'JHN', chapter: 4 });
  assert.deepEqual(getPrevChapterRef('JHN', 4), { book: 'JHN', chapter: 3 });

  // End of book -> Chapter 1 of next book
  assert.deepEqual(getNextChapterRef('GEN', 50), { book: 'EXO', chapter: 1 });
  assert.deepEqual(getNextChapterRef('MAL', 4), { book: 'MAT', chapter: 1 });
  assert.deepEqual(getNextChapterRef('JHN', 21), { book: 'ACT', chapter: 1 });

  // Start of book Chapter 1 -> Final chapter of previous book
  assert.deepEqual(getPrevChapterRef('EXO', 1), { book: 'GEN', chapter: 50 });
  assert.deepEqual(getPrevChapterRef('MAT', 1), { book: 'MAL', chapter: 4 });
  assert.deepEqual(getPrevChapterRef('ACT', 1), { book: 'JHN', chapter: 21 });

  // Canon start & end boundaries
  assert.equal(getPrevChapterRef('GEN', 1), null);
  assert.equal(getNextChapterRef('REV', 22), null);
});

test('Two-column paginator packs left/right columns and locates verses accurately', () => {
  const verses = Array.from({ length: 10 }, (_, idx) => ({
    v: idx + 1,
    t: `Verse text ${idx + 1}`
  }));
  const heights = new Array(10).fill(50);

  // Column max height 120 with gap 10 fits two 50px verses per column (50 + 10 + 50 = 110 <= 120),
  // so 4 verses per two-column spread -> 3 spreads total (1-4, 5-8, 9-10).
  const spreads = packVersesIntoSpreads(verses, heights, 120, 10);
  assert.equal(spreads.length, 3);
  assert.deepEqual(
    spreads.map((s) => [s.startVerse, s.endVerse, s.leftVerses.length, s.rightVerses.length]),
    [
      [1, 4, 2, 2],
      [5, 8, 2, 2],
      [9, 10, 2, 0]
    ]
  );

  assert.equal(findSpreadIndexForVerse(spreads, 1), 0);
  assert.equal(findSpreadIndexForVerse(spreads, 4), 0);
  assert.equal(findSpreadIndexForVerse(spreads, 6), 1);
  assert.equal(findSpreadIndexForVerse(spreads, 10), 2);

  // Oversized single verse still makes forward progress without infinite loop
  const tallSpreads = packVersesIntoSpreads([{ v: 1, t: 'Huge' }, { v: 2, t: 'Next' }], [500, 40], 200, 8);
  assert.equal(tallSpreads.length, 1);
  assert.equal(tallSpreads[0].leftVerses.length, 1);
  assert.equal(tallSpreads[0].rightVerses.length, 1);
});

test('2D spatial navigation selects aligned grid neighbors and crosses section gaps', () => {
  // Simulate a 3-column grid row 1 + row 2
  const entries = [
    { item: 'r1c1', rect: { left: 0, top: 0, right: 100, bottom: 40 } },
    { item: 'r1c2', rect: { left: 110, top: 0, right: 210, bottom: 40 } },
    { item: 'r1c3', rect: { left: 220, top: 0, right: 320, bottom: 40 } },
    { item: 'r2c1', rect: { left: 0, top: 80, right: 100, bottom: 120 } },
    { item: 'r2c2', rect: { left: 110, top: 80, right: 210, bottom: 120 } }
  ];

  const r1c2 = entries[1].rect;
  const others = entries.filter((e) => e.item !== 'r1c2');

  assert.equal(pickSpatialCandidate(r1c2, others, 'ArrowRight'), 'r1c3');
  assert.equal(pickSpatialCandidate(r1c2, others, 'ArrowLeft'), 'r1c1');
  assert.equal(pickSpatialCandidate(r1c2, others, 'ArrowDown'), 'r2c2');
  assert.equal(pickSpatialCandidate(r1c2, others, 'ArrowUp'), null);
});

test('Universal Bible loader and NLT parser normalize external schemas', () => {
  // Book-name nested object format common in personal NIV / NKJV JSON exports
  const nestedRaw = {
    Genesis: {
      1: {
        1: 'In the beginning God created the heavens and the earth.',
        2: 'Now the earth was formless and empty.'
      }
    }
  };
  const niv = normalizeBiblePayload(nestedRaw, { id: 'NIV' });
  assert.equal(niv.id, 'NIV');
  assert.equal(niv.name, 'New International Version');
  assert.equal(niv.books.GEN['1'].length, 2);
  assert.equal(niv.books.GEN['1'][0].v, 1);

  // NLT HTML parser
  const sampleHtml = `
    <verse_export orig="john_3_16" bk="john" ch="3" vn="16">
      <p><span class="vn">16</span>"For this is how God loved the world<a class="a-tn">*</a><span class="tn">footnote</span>: He gave his one and only Son."</p>
    </verse_export>
  `;
  const parsedNlt = parseNltHtmlVerses(sampleHtml);
  assert.equal(parsedNlt.length, 1);
  assert.equal(parsedNlt[0].v, 16);
  assert.match(parsedNlt[0].t, /For this is how God loved the world/);
  assert.doesNotMatch(parsedNlt[0].t, /footnote/);
});

test('API.Bible provider normalizes base URL to /v1 and parses USX JSON content', async () => {
  const requestedUrls = [];
  const provider = createApiBibleProvider({
    apiKey: 'test-key',
    baseUrl: 'https://rest.api.bible/',
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      if (url.includes('/bibles?')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: '78a9f6124f344018-01', name: 'New International Version', abbreviation: 'engNIV11', type: 'text' },
              { id: '63097d2a0a2f7db3-01', name: 'New King James Version', abbreviation: 'engNKJV', type: 'text' },
              { id: 'd6e14a625393b4da-01', name: 'New Living Translation', abbreviation: 'engNLT', type: 'text' }
            ]
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            copyright: 'NIV Copyright',
            content: [
              {
                name: 'para',
                type: 'tag',
                attrs: { style: 's1' },
                items: [{ text: 'The Beginning' }]
              },
              {
                name: 'para',
                type: 'tag',
                attrs: { style: 'p' },
                items: [
                  { text: '1 ', type: 'tag', attrs: { style: 'v', sid: 'GEN 1:1' } },
                  { text: 'In the beginning God created the heavens and the earth.' }
                ]
              }
            ]
          }
        })
      };
    }
  });

  const list = await provider.listTranslations();
  assert.deepEqual(list.map((t) => t.id), ['NIV', 'NKJV', 'NLT']);
  assert.ok(requestedUrls[0].startsWith('https://rest.api.bible/v1/bibles'));

  const ch = await provider.getChapter('NIV', 'GEN', 1);
  assert.equal(ch.verses[0].v, 1);
  assert.equal(ch.verses[0].t, 'In the beginning God created the heavens and the earth.');
  assert.doesNotMatch(ch.verses[0].t, /The Beginning/);
  assert.ok(requestedUrls[1].startsWith('https://rest.api.bible/v1/bibles/78a9f6124f344018-01/chapters/GEN.1'));
});

test('tvbible HTTP server serves built-in translations, API.Bible translations, and UI without footer', async () => {
  const mockFetch = async (url) => {
    if (url.includes('/bibles?')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: '78a9f6124f344018-01', name: 'New International Version', abbreviation: 'engNIV', type: 'text' },
            { id: '63097d2a0a2f7db3-01', name: 'New King James Version', abbreviation: 'engNKJV', type: 'text' },
            { id: 'd6e14a625393b4da-01', name: 'New Living Translation', abbreviation: 'engNLT', type: 'text' }
          ]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        data: {
          copyright: 'Licensed via API.Bible',
          content: [
            {
              name: 'para',
              attrs: { style: 'p' },
              items: [
                { text: '1 ', type: 'tag', attrs: { style: 'v', sid: 'GEN 1:1' } },
                { text: 'In the beginning God created the heavens and the earth.' }
              ]
            }
          ]
        }
      })
    };
  };

  const { inject } = await createBibleApp({ apiBibleKey: 'mock-key', fetchImpl: mockFetch });

  const health = (await inject('/api/health')).json();
  assert.equal(health.status, 'ok');
  assert.deepEqual(health.translations, ['NIV', 'NLT', 'NKJV', 'BSB', 'WEB', 'KJV', 'ASV']);

  const jhn3 = (await inject('/api/chapter/BSB/JHN/3')).json();
  assert.equal(jhn3.book, 'JHN');
  assert.equal(jhn3.chapter, 3);
  assert.equal(jhn3.verses.length, 36);
  assert.match(jhn3.verses[15].t, /For God so loved the world/);
  assert.deepEqual(jhn3.next, { book: 'JHN', chapter: 4 });
  assert.deepEqual(jhn3.prev, { book: 'JHN', chapter: 2 });

  const gen50 = (await inject('/api/chapter/BSB/GEN/50')).json();
  assert.deepEqual(gen50.next, { book: 'EXO', chapter: 1 });

  const rev22 = (await inject('/api/chapter/KJV/REV/22')).json();
  assert.equal(rev22.next, null);
  assert.deepEqual(rev22.prev, { book: 'REV', chapter: 21 });

  const nivGen1 = (await inject('/api/chapter/NIV/GEN/1')).json();
  assert.equal(nivGen1.translation, 'NIV');
  assert.equal(nivGen1.translationName, 'New International Version');
  assert.equal(nivGen1.verses[0].v, 1);

  const nkjGen1 = (await inject('/api/chapter/NKJ/GEN/1')).json();
  assert.equal(nkjGen1.translation, 'NKJV');
  assert.equal(nkjGen1.verses[0].v, 1);

  const htmlRes = await inject('/');
  assert.equal(htmlRes.status, 200);
  const html = htmlRes.text();
  assert.match(html, /<title>tvbible<\/title>/);
  assert.match(html, /<dialog id="picker-dialog" closedby="any"/);
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.doesNotMatch(html, /<footer\b/i);

  const cssRes = await inject('/styles.css');
  assert.equal(cssRes.status, 200);
  assert.match(cssRes.text(), /overscroll-behavior:\s*contain/);
});
