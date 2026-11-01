/**
 * Canonical 66-book Protestant Bible metadata shared between server and client.
 */
export const CANON_BOOKS = [
  // Old Testament (39 books)
  { index: 1, id: 'GEN', name: 'Genesis', shortName: 'Gen', testament: 'OT', chapters: 50, aliases: ['gn', 'ge', 'gen'] },
  { index: 2, id: 'EXO', name: 'Exodus', shortName: 'Exod', testament: 'OT', chapters: 40, aliases: ['ex', 'exo', 'exod'] },
  { index: 3, id: 'LEV', name: 'Leviticus', shortName: 'Lev', testament: 'OT', chapters: 27, aliases: ['lv', 'le', 'lev'] },
  { index: 4, id: 'NUM', name: 'Numbers', shortName: 'Num', testament: 'OT', chapters: 36, aliases: ['nm', 'nu', 'num', 'nb'] },
  { index: 5, id: 'DEU', name: 'Deuteronomy', shortName: 'Deut', testament: 'OT', chapters: 34, aliases: ['dt', 'de', 'deu', 'deut'] },
  { index: 6, id: 'JOS', name: 'Joshua', shortName: 'Josh', testament: 'OT', chapters: 24, aliases: ['js', 'jos', 'josh'] },
  { index: 7, id: 'JDG', name: 'Judges', shortName: 'Judg', testament: 'OT', chapters: 21, aliases: ['jg', 'jdg', 'judg', 'jdgs'] },
  { index: 8, id: 'RUT', name: 'Ruth', shortName: 'Ruth', testament: 'OT', chapters: 4, aliases: ['rt', 'ru', 'rut', 'rth'] },
  { index: 9, id: '1SA', name: '1 Samuel', shortName: '1 Sam', testament: 'OT', chapters: 31, aliases: ['1sm', '1sa', '1sam', 'i samuel', '1st samuel'] },
  { index: 10, id: '2SA', name: '2 Samuel', shortName: '2 Sam', testament: 'OT', chapters: 24, aliases: ['2sm', '2sa', '2sam', 'ii samuel', '2nd samuel'] },
  { index: 11, id: '1KI', name: '1 Kings', shortName: '1 Kgs', testament: 'OT', chapters: 22, aliases: ['1kgs', '1ki', '1kin', 'i kings', '1st kings'] },
  { index: 12, id: '2KI', name: '2 Kings', shortName: '2 Kgs', testament: 'OT', chapters: 25, aliases: ['2kgs', '2ki', '2kin', 'ii kings', '2nd kings'] },
  { index: 13, id: '1CH', name: '1 Chronicles', shortName: '1 Chr', testament: 'OT', chapters: 29, aliases: ['1ch', '1chr', '1chron', 'i chronicles', '1st chronicles'] },
  { index: 14, id: '2CH', name: '2 Chronicles', shortName: '2 Chr', testament: 'OT', chapters: 36, aliases: ['2ch', '2chr', '2chron', 'ii chronicles', '2nd chronicles'] },
  { index: 15, id: 'EZR', name: 'Ezra', shortName: 'Ezra', testament: 'OT', chapters: 10, aliases: ['ezr', 'ezra'] },
  { index: 16, id: 'NEH', name: 'Nehemiah', shortName: 'Neh', testament: 'OT', chapters: 13, aliases: ['ne', 'neh'] },
  { index: 17, id: 'EST', name: 'Esther', shortName: 'Esth', testament: 'OT', chapters: 10, aliases: ['et', 'es', 'est', 'esth'] },
  { index: 18, id: 'JOB', name: 'Job', shortName: 'Job', testament: 'OT', chapters: 42, aliases: ['jb', 'job'] },
  { index: 19, id: 'PSA', name: 'Psalms', shortName: 'Ps', testament: 'OT', chapters: 150, aliases: ['ps', 'psa', 'psalm', 'psalms', 'pss'] },
  { index: 20, id: 'PRO', name: 'Proverbs', shortName: 'Prov', testament: 'OT', chapters: 31, aliases: ['prv', 'pr', 'pro', 'prov'] },
  { index: 21, id: 'ECC', name: 'Ecclesiastes', shortName: 'Eccl', testament: 'OT', chapters: 12, aliases: ['ec', 'ecc', 'eccl', 'qoh'] },
  { index: 22, id: 'SNG', name: 'Song of Solomon', shortName: 'Song', testament: 'OT', chapters: 8, aliases: ['so', 'sg', 'sng', 'song', 'song of songs', 'canticles', 'sos'] },
  { index: 23, id: 'ISA', name: 'Isaiah', shortName: 'Isa', testament: 'OT', chapters: 66, aliases: ['is', 'isa'] },
  { index: 24, id: 'JER', name: 'Jeremiah', shortName: 'Jer', testament: 'OT', chapters: 52, aliases: ['jr', 'je', 'jer'] },
  { index: 25, id: 'LAM', name: 'Lamentations', shortName: 'Lam', testament: 'OT', chapters: 5, aliases: ['lm', 'la', 'lam'] },
  { index: 26, id: 'EZK', name: 'Ezekiel', shortName: 'Ezek', testament: 'OT', chapters: 48, aliases: ['ez', 'eze', 'ezk', 'ezek'] },
  { index: 27, id: 'DAN', name: 'Daniel', shortName: 'Dan', testament: 'OT', chapters: 12, aliases: ['dn', 'da', 'dan'] },
  { index: 28, id: 'HOS', name: 'Hosea', shortName: 'Hos', testament: 'OT', chapters: 14, aliases: ['ho', 'hos'] },
  { index: 29, id: 'JOL', name: 'Joel', shortName: 'Joel', testament: 'OT', chapters: 3, aliases: ['jl', 'joe', 'jol', 'joel'] },
  { index: 30, id: 'AMO', name: 'Amos', shortName: 'Amos', testament: 'OT', chapters: 9, aliases: ['am', 'amo', 'amos'] },
  { index: 31, id: 'OBA', name: 'Obadiah', shortName: 'Obad', testament: 'OT', chapters: 1, aliases: ['ob', 'oba', 'obad'] },
  { index: 32, id: 'JON', name: 'Jonah', shortName: 'Jonah', testament: 'OT', chapters: 4, aliases: ['jn', 'jon', 'jnh'] },
  { index: 33, id: 'MIC', name: 'Micah', shortName: 'Mic', testament: 'OT', chapters: 7, aliases: ['mi', 'mic'] },
  { index: 34, id: 'NAM', name: 'Nahum', shortName: 'Nah', testament: 'OT', chapters: 3, aliases: ['na', 'nah', 'nam'] },
  { index: 35, id: 'HAB', name: 'Habakkuk', shortName: 'Hab', testament: 'OT', chapters: 3, aliases: ['hk', 'hab'] },
  { index: 36, id: 'ZEP', name: 'Zephaniah', shortName: 'Zeph', testament: 'OT', chapters: 3, aliases: ['zp', 'zep', 'zeph'] },
  { index: 37, id: 'HAG', name: 'Haggai', shortName: 'Hag', testament: 'OT', chapters: 2, aliases: ['hg', 'hag'] },
  { index: 38, id: 'ZEC', name: 'Zechariah', shortName: 'Zech', testament: 'OT', chapters: 14, aliases: ['zc', 'zec', 'zech'] },
  { index: 39, id: 'MAL', name: 'Malachi', shortName: 'Mal', testament: 'OT', chapters: 4, aliases: ['ml', 'mal'] },

  // New Testament (27 books)
  { index: 40, id: 'MAT', name: 'Matthew', shortName: 'Matt', testament: 'NT', chapters: 28, aliases: ['mt', 'mat', 'matt'] },
  { index: 41, id: 'MRK', name: 'Mark', shortName: 'Mark', testament: 'NT', chapters: 16, aliases: ['mk', 'mr', 'mrk', 'mar'] },
  { index: 42, id: 'LUK', name: 'Luke', shortName: 'Luke', testament: 'NT', chapters: 24, aliases: ['lk', 'lu', 'luk'] },
  { index: 43, id: 'JHN', name: 'John', shortName: 'John', testament: 'NT', chapters: 21, aliases: ['jo', 'joh', 'jhn', 'john'] },
  { index: 44, id: 'ACT', name: 'Acts', shortName: 'Acts', testament: 'NT', chapters: 28, aliases: ['ac', 'act', 'acts', 'acts of the apostles'] },
  { index: 45, id: 'ROM', name: 'Romans', shortName: 'Rom', testament: 'NT', chapters: 16, aliases: ['rm', 'ro', 'rom'] },
  { index: 46, id: '1CO', name: '1 Corinthians', shortName: '1 Cor', testament: 'NT', chapters: 16, aliases: ['1co', '1cor', 'i corinthians', '1st corinthians'] },
  { index: 47, id: '2CO', name: '2 Corinthians', shortName: '2 Cor', testament: 'NT', chapters: 13, aliases: ['2co', '2cor', 'ii corinthians', '2nd corinthians'] },
  { index: 48, id: 'GAL', name: 'Galatians', shortName: 'Gal', testament: 'NT', chapters: 6, aliases: ['gl', 'ga', 'gal'] },
  { index: 49, id: 'EPH', name: 'Ephesians', shortName: 'Eph', testament: 'NT', chapters: 6, aliases: ['ep', 'eph'] },
  { index: 50, id: 'PHP', name: 'Philippians', shortName: 'Phil', testament: 'NT', chapters: 4, aliases: ['ph', 'php', 'phil'] },
  { index: 51, id: 'COL', name: 'Colossians', shortName: 'Col', testament: 'NT', chapters: 4, aliases: ['cl', 'col'] },
  { index: 52, id: '1TH', name: '1 Thessalonians', shortName: '1 Thess', testament: 'NT', chapters: 5, aliases: ['1ts', '1th', '1thess', 'i thessalonians', '1st thessalonians'] },
  { index: 53, id: '2TH', name: '2 Thessalonians', shortName: '2 Thess', testament: 'NT', chapters: 3, aliases: ['2ts', '2th', '2thess', 'ii thessalonians', '2nd thessalonians'] },
  { index: 54, id: '1TI', name: '1 Timothy', shortName: '1 Tim', testament: 'NT', chapters: 6, aliases: ['1tm', '1ti', '1tim', 'i timothy', '1st timothy'] },
  { index: 55, id: '2TI', name: '2 Timothy', shortName: '2 Tim', testament: 'NT', chapters: 4, aliases: ['2tm', '2ti', '2tim', 'ii timothy', '2nd timothy'] },
  { index: 56, id: 'TIT', name: 'Titus', shortName: 'Titus', testament: 'NT', chapters: 3, aliases: ['tt', 'ti', 'tit', 'titus'] },
  { index: 57, id: 'PHM', name: 'Philemon', shortName: 'Phlm', testament: 'NT', chapters: 1, aliases: ['pm', 'phm', 'phlm', 'philem'] },
  { index: 58, id: 'HEB', name: 'Hebrews', shortName: 'Heb', testament: 'NT', chapters: 13, aliases: ['hb', 'heb'] },
  { index: 59, id: 'JAS', name: 'James', shortName: 'Jas', testament: 'NT', chapters: 5, aliases: ['jm', 'ja', 'jas', 'jam'] },
  { index: 60, id: '1PE', name: '1 Peter', shortName: '1 Pet', testament: 'NT', chapters: 5, aliases: ['1pe', '1pt', '1pet', 'i peter', '1st peter'] },
  { index: 61, id: '2PE', name: '2 Peter', shortName: '2 Pet', testament: 'NT', chapters: 3, aliases: ['2pe', '2pt', '2pet', 'ii peter', '2nd peter'] },
  { index: 62, id: '1JN', name: '1 John', shortName: '1 John', testament: 'NT', chapters: 5, aliases: ['1jo', '1jn', '1jhn', 'i john', '1st john'] },
  { index: 63, id: '2JN', name: '2 John', shortName: '2 John', testament: 'NT', chapters: 1, aliases: ['2jo', '2jn', '2jhn', 'ii john', '2nd john'] },
  { index: 64, id: '3JN', name: '3 John', shortName: '3 John', testament: 'NT', chapters: 1, aliases: ['3jo', '3jn', '3jhn', 'iii john', '3rd john'] },
  { index: 65, id: 'JUD', name: 'Jude', shortName: 'Jude', testament: 'NT', chapters: 1, aliases: ['jd', 'jud', 'jude'] },
  { index: 66, id: 'REV', name: 'Revelation', shortName: 'Rev', testament: 'NT', chapters: 22, aliases: ['re', 'rv', 'rev', 'revelations', 'apocalypse', 'revelation of john'] }
];

export const BOOKS_BY_ID = new Map(CANON_BOOKS.map((b) => [b.id, b]));
export const BOOKS_BY_INDEX = new Map(CANON_BOOKS.map((b) => [b.index, b]));

const NORMALIZED_LOOKUP = new Map();
for (const book of CANON_BOOKS) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  NORMALIZED_LOOKUP.set(norm(book.id), book);
  NORMALIZED_LOOKUP.set(norm(book.name), book);
  NORMALIZED_LOOKUP.set(norm(book.shortName), book);
  for (const alias of book.aliases) {
    NORMALIZED_LOOKUP.set(norm(alias), book);
  }
}
// Roman numeral prefix aliases (e.g., "I Samuel", "II Kings", "III John")
const ROMAN_ALIASES = [
  ['isamuel', '1SA'], ['iisamuel', '2SA'],
  ['ikings', '1KI'], ['iikings', '2KI'],
  ['ichronicles', '1CH'], ['iichronicles', '2CH'],
  ['icorinthians', '1CO'], ['iicorinthians', '2CO'],
  ['ithessalonians', '1TH'], ['iithessalonians', '2TH'],
  ['itimothy', '1TI'], ['iitimothy', '2TI'],
  ['ipeter', '1PE'], ['iipeter', '2PE'],
  ['ijohn', '1JN'], ['iijohn', '2JN'], ['iiijohn', '3JN']
];
for (const [key, id] of ROMAN_ALIASES) {
  NORMALIZED_LOOKUP.set(key, BOOKS_BY_ID.get(id));
}

/**
 * Resolve a book by ID ("JHN"), full name ("John"), alias ("1co"), or 1-based number (43).
 */
export function resolveBook(input) {
  if (typeof input === 'number' || /^\d+$/.test(String(input).trim())) {
    return BOOKS_BY_INDEX.get(Number(input)) || null;
  }
  if (!input) return null;
  const key = String(input).toLowerCase().replace(/[^a-z0-9]/g, '');
  return NORMALIZED_LOOKUP.get(key) || null;
}

/**
 * Compute the next chapter/book reference across canonical boundaries.
 * Returns null if already at the end of Revelation 22.
 */
export function getNextChapterRef(bookId, chapter, booksMeta = CANON_BOOKS) {
  const idx = booksMeta.findIndex((b) => b.id === bookId);
  if (idx === -1) return null;
  const currentBook = booksMeta[idx];
  if (chapter < currentBook.chapters) {
    return { book: currentBook.id, chapter: chapter + 1 };
  }
  if (idx + 1 < booksMeta.length) {
    const nextBook = booksMeta[idx + 1];
    return { book: nextBook.id, chapter: 1 };
  }
  return null;
}

/**
 * Compute the previous chapter/book reference across canonical boundaries.
 * Returns null if already at Genesis 1.
 */
export function getPrevChapterRef(bookId, chapter, booksMeta = CANON_BOOKS) {
  const idx = booksMeta.findIndex((b) => b.id === bookId);
  if (idx === -1) return null;
  if (chapter > 1) {
    return { book: booksMeta[idx].id, chapter: chapter - 1 };
  }
  if (idx > 0) {
    const prevBook = booksMeta[idx - 1];
    return { book: prevBook.id, chapter: prevBook.chapters };
  }
  return null;
}
