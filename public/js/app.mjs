import { CANON_BOOKS, getNextChapterRef, getPrevChapterRef, resolveBook } from './canon.mjs';
import { attachSpatialNavigation, setRovingActive } from './spatial-nav.mjs';
import {
  measureAndPaginateChapter,
  findSpreadIndexForVerse,
  createVerseElement
} from './paginator.mjs';
import {
  loadReadingState,
  saveReadingState,
  clampFontScale,
  toggleColorScheme,
  initColorSchemeSync
} from './storage.mjs';

// DOM Elements
const topBar = document.getElementById('top-bar');
const btnTranslation = document.getElementById('btn-translation');
const btnBook = document.getElementById('btn-book');
const btnChapter = document.getElementById('btn-chapter');
const btnVerse = document.getElementById('btn-verse');
const btnFontDown = document.getElementById('btn-font-down');
const btnFontUp = document.getElementById('btn-font-up');
const btnTheme = document.getElementById('btn-theme');

const valTranslation = document.getElementById('val-translation');
const valBook = document.getElementById('val-book');
const valChapter = document.getElementById('val-chapter');
const valVerse = document.getElementById('val-verse');

const readingStage = document.getElementById('reading-stage');
const spreadGrid = document.getElementById('spread-grid');
const colLeft = document.getElementById('col-left');
const colRight = document.getElementById('col-right');
const edgePrev = document.getElementById('edge-prev');
const edgeNext = document.getElementById('edge-next');
const measureHost = document.getElementById('measure-host');
const measureColumn = document.getElementById('measure-column');

const pickerDialog = document.getElementById('picker-dialog');
const pickerDialogTitle = document.getElementById('picker-dialog-title');
const pickerBody = document.getElementById('picker-body');

// Runtime State
const state = {
  ...loadReadingState(),
  translations: [],
  booksByTranslation: new Map(),
  chapterCache: new Map(),
  currentChapterData: null,
  spreads: [],
  spreadIndex: 0,
  highlightedVerse: null,
  loadSeq: 0
};

let highlightTimer = null;

function applyFontScale(scale) {
  state.fontScale = clampFontScale(scale);
  document.documentElement.style.setProperty('--font-scale', String(state.fontScale));
}

function getBooksMeta(translationId = state.translation) {
  return state.booksByTranslation.get(translationId) || CANON_BOOKS;
}

function getBookMeta(bookId, translationId = state.translation) {
  return getBooksMeta(translationId).find((b) => b.id === bookId) || resolveBook(bookId) || CANON_BOOKS[0];
}

// ============================================================================
// Data Fetching & Adjacent-Chapter Prefetching
// ============================================================================

async function fetchTranslations() {
  const res = await fetch('/api/translations');
  if (!res.ok) throw new Error(`Failed loading translations (HTTP ${res.status})`);
  const data = await res.json();
  state.translations = data.translations || [];
  return state.translations;
}

async function ensureBooksForTranslation(translationId) {
  if (state.booksByTranslation.has(translationId)) {
    return state.booksByTranslation.get(translationId);
  }
  const res = await fetch(`/api/books/${encodeURIComponent(translationId)}`);
  if (!res.ok) {
    state.booksByTranslation.set(translationId, CANON_BOOKS);
    return CANON_BOOKS;
  }
  const data = await res.json();
  const books = Array.isArray(data.books) && data.books.length > 0 ? data.books : CANON_BOOKS;
  state.booksByTranslation.set(translationId, books);
  return books;
}

function makeChapterKey(translationId, bookId, chapter) {
  return `${translationId}:${bookId}:${chapter}`;
}

async function fetchChapterData(translationId, bookId, chapter) {
  const key = makeChapterKey(translationId, bookId, chapter);
  if (state.chapterCache.has(key)) {
    return state.chapterCache.get(key);
  }

  const res = await fetch(
    `/api/chapter/${encodeURIComponent(translationId)}/${encodeURIComponent(bookId)}/${Number(chapter)}`
  );
  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload.error || `HTTP ${res.status}`);
  }
  const data = await res.json();

  // Keep bounded cache of 60 chapters in client memory
  if (state.chapterCache.size >= 60) {
    const oldest = state.chapterCache.keys().next().value;
    state.chapterCache.delete(oldest);
  }
  state.chapterCache.set(key, data);
  return data;
}

function prefetchAdjacentChapters(translationId, bookId, chapter) {
  const booksMeta = getBooksMeta(translationId);
  const prevRef = getPrevChapterRef(bookId, chapter, booksMeta);
  const nextRef = getNextChapterRef(bookId, chapter, booksMeta);

  for (const ref of [prevRef, nextRef]) {
    if (!ref) continue;
    const key = makeChapterKey(translationId, ref.book, ref.chapter);
    if (!state.chapterCache.has(key)) {
      fetchChapterData(translationId, ref.book, ref.chapter).catch(() => {});
    }
  }
}

// ============================================================================
// Rendering & Live Top-Header Synchronization
// ============================================================================

function syncHeaderControls() {
  const transMeta = state.translations.find((t) => t.id === state.translation);
  valTranslation.textContent = transMeta ? transMeta.shortName : state.translation;
  btnTranslation.setAttribute(
    'aria-label',
    `Select Translation, currently ${transMeta ? transMeta.name : state.translation}`
  );

  const bookMeta = getBookMeta(state.book);
  valBook.textContent = bookMeta.name;
  btnBook.setAttribute('aria-label', `Select Book, currently ${bookMeta.name}`);

  valChapter.textContent = String(state.chapter);
  btnChapter.setAttribute('aria-label', `Select Chapter, currently Chapter ${state.chapter}`);

  const currentSpread = state.spreads[state.spreadIndex];
  if (currentSpread) {
    const verseLabel =
      currentSpread.startVerse === currentSpread.endVerse
        ? String(currentSpread.startVerse)
        : `${currentSpread.startVerse}\u2013${currentSpread.endVerse}`;
    valVerse.textContent = verseLabel;
    btnVerse.setAttribute('aria-label', `Select Verse, currently showing ${verseLabel}`);
  } else {
    valVerse.textContent = String(state.verse);
  }

  // Update pointer edge gutters at Genesis 1:1 and Revelation 22 end boundaries
  const booksMeta = getBooksMeta();
  const atCanonStart =
    state.spreadIndex === 0 && getPrevChapterRef(state.book, state.chapter, booksMeta) === null;
  const atCanonEnd =
    state.spreadIndex >= state.spreads.length - 1 &&
    getNextChapterRef(state.book, state.chapter, booksMeta) === null;

  edgePrev.disabled = atCanonStart;
  edgeNext.disabled = atCanonEnd;
}

function renderCurrentSpread() {
  const spread = state.spreads[state.spreadIndex];
  if (!spread) return;

  const leftFrag = document.createDocumentFragment();
  for (const v of spread.leftVerses) {
    leftFrag.appendChild(createVerseElement(v, state.highlightedVerse));
  }
  const rightFrag = document.createDocumentFragment();
  for (const v of spread.rightVerses) {
    rightFrag.appendChild(createVerseElement(v, state.highlightedVerse));
  }

  colLeft.replaceChildren(leftFrag);
  colRight.replaceChildren(rightFrag);

  // Restore divider if replaced by status banner
  if (!spreadGrid.contains(colLeft)) {
    const divider = document.createElement('div');
    divider.className = 'column-divider';
    divider.setAttribute('aria-hidden', 'true');
    spreadGrid.replaceChildren(colLeft, divider, colRight);
  }

  syncHeaderControls();
  document.title = `${getBookMeta(state.book).name} ${state.chapter}:${valVerse.textContent} (${state.translation}) — tvbible`;
}

function showStatusMessage(message) {
  const banner = document.createElement('div');
  banner.className = 'status-banner';
  banner.textContent = message;
  spreadGrid.replaceChildren(banner);
}

function paginateCurrentChapter({ targetVerse = state.verse, landAtEnd = false } = {}) {
  const chapData = state.currentChapterData;
  if (!chapData || !Array.isArray(chapData.verses) || chapData.verses.length === 0) return;

  state.spreads = measureAndPaginateChapter({
    verses: chapData.verses,
    measureHost,
    measureColumn,
    colLeft,
    spreadGrid
  });

  if (landAtEnd) {
    state.spreadIndex = Math.max(0, state.spreads.length - 1);
    state.verse = state.spreads[state.spreadIndex]?.startVerse || 1;
  } else {
    state.spreadIndex = findSpreadIndexForVerse(state.spreads, targetVerse);
    state.verse = targetVerse;
  }

  renderCurrentSpread();
  saveReadingState(state);
}

/**
 * Load a passage and render its target spread.
 */
async function loadPassage({
  translation = state.translation,
  book = state.book,
  chapter = state.chapter,
  verse = 1,
  landAtEnd = false,
  highlight = false
} = {}) {
  const seq = ++state.loadSeq;

  try {
    const booksMeta = await ensureBooksForTranslation(translation);
    if (seq !== state.loadSeq) return;

    const validBook = booksMeta.find((b) => b.id === book) || booksMeta[0];
    const safeChapter = Math.min(Math.max(1, Number(chapter) || 1), validBook.chapters);

    const chapData = await fetchChapterData(translation, validBook.id, safeChapter);
    if (seq !== state.loadSeq) return;

    state.translation = chapData.translation || translation;
    state.book = validBook.id;
    state.chapter = safeChapter;
    state.currentChapterData = chapData;

    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
    state.highlightedVerse = highlight ? verse : null;

    // Ensure two-column containers are mounted before measuring column width
    if (!spreadGrid.contains(colLeft)) {
      const divider = document.createElement('div');
      divider.className = 'column-divider';
      divider.setAttribute('aria-hidden', 'true');
      spreadGrid.replaceChildren(colLeft, divider, colRight);
    }

    paginateCurrentChapter({ targetVerse: verse, landAtEnd });
    prefetchAdjacentChapters(state.translation, state.book, state.chapter);

    if (highlight) {
      highlightTimer = setTimeout(() => {
        state.highlightedVerse = null;
        for (const el of spreadGrid.querySelectorAll('.verse-item.is-highlighted')) {
          el.classList.remove('is-highlighted');
        }
      }, 2400);
    }
  } catch (err) {
    if (seq !== state.loadSeq) return;
    showStatusMessage(`Unable to load passage: ${err.message}`);
  }
}

// ============================================================================
// Explicit Spread, Chapter & Book Boundary Navigation (Left / Right)
// ============================================================================

async function goNextSpread() {
  if (state.spreads.length === 0) return;

  // 1. Advance to next two-column spread within current chapter
  if (state.spreadIndex + 1 < state.spreads.length) {
    state.spreadIndex += 1;
    state.highlightedVerse = null;
    state.verse = state.spreads[state.spreadIndex].startVerse;
    renderCurrentSpread();
    saveReadingState(state);
    return;
  }

  // 2. At end of chapter -> move to Chapter + 1 (or Chapter 1 of Next Book)
  const nextRef = getNextChapterRef(state.book, state.chapter, getBooksMeta());
  if (!nextRef) return; // Already at end of Revelation 22

  await loadPassage({
    translation: state.translation,
    book: nextRef.book,
    chapter: nextRef.chapter,
    verse: 1,
    landAtEnd: false
  });
}

async function goPrevSpread() {
  if (state.spreads.length === 0) return;

  // 1. Move to previous two-column spread within current chapter
  if (state.spreadIndex > 0) {
    state.spreadIndex -= 1;
    state.highlightedVerse = null;
    state.verse = state.spreads[state.spreadIndex].startVerse;
    renderCurrentSpread();
    saveReadingState(state);
    return;
  }

  // 2. At Spread 1 of chapter -> move to Final Spread of Previous Chapter (or Previous Book's Last Chapter)
  const prevRef = getPrevChapterRef(state.book, state.chapter, getBooksMeta());
  if (!prevRef) return; // Already at Genesis 1:1

  await loadPassage({
    translation: state.translation,
    book: prevRef.book,
    chapter: prevRef.chapter,
    landAtEnd: true
  });
}

// ============================================================================
// 2D Grid Modal Pickers (<dialog>)
// ============================================================================

function closePickerWithSelection() {
  pickerDialog.returnValue = 'selected';
  pickerDialog.close('selected');
}

function openPickerModal(title, buildContentFn) {
  pickerDialogTitle.textContent = title;
  pickerBody.replaceChildren();
  const activeItem = buildContentFn(pickerBody);

  pickerDialog.returnValue = '';
  pickerDialog.showModal();

  // Set roving tabindex on the currently selected item inside the modal
  setRovingActive(pickerDialog, '[data-spatial-item]', activeItem, {
    focus: true,
    scroll: true
  });
}

function openTranslationPicker() {
  openPickerModal('Select Translation', (container) => {
    const grid = document.createElement('div');
    grid.className = 'picker-grid picker-grid-translations';
    let activeBtn = null;

    for (const t of state.translations) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-item picker-item-translation';
      btn.setAttribute('data-spatial-item', '');
      if (t.id === state.translation) {
        btn.classList.add('is-active');
        activeBtn = btn;
      }

      const code = document.createElement('span');
      code.className = 'picker-item-code';
      code.textContent = t.shortName;

      const full = document.createElement('span');
      full.textContent = t.name;

      const sub = document.createElement('span');
      sub.className = 'picker-item-sub';
      sub.textContent = t.license;

      btn.append(code, full, sub);
      btn.addEventListener('click', () => {
        const currentSpread = state.spreads[state.spreadIndex];
        const anchorVerse = currentSpread ? currentSpread.startVerse : state.verse;
        closePickerWithSelection();
        loadPassage({
          translation: t.id,
          book: state.book,
          chapter: state.chapter,
          verse: anchorVerse
        });
      });
      grid.appendChild(btn);
    }

    container.appendChild(grid);
    return activeBtn;
  });
}

function openBookPicker() {
  openPickerModal('Select Book', (container) => {
    const books = getBooksMeta();
    let activeBtn = null;

    const sections = [
      { label: 'Old Testament', items: books.filter((b) => b.testament === 'OT') },
      { label: 'New Testament', items: books.filter((b) => b.testament === 'NT') }
    ];

    for (const sec of sections) {
      if (sec.items.length === 0) continue;
      const wrapper = document.createElement('section');
      const heading = document.createElement('h3');
      heading.className = 'picker-section-title';
      heading.textContent = sec.label;

      const grid = document.createElement('div');
      grid.className = 'picker-grid picker-grid-books';

      for (const b of sec.items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'picker-item';
        btn.setAttribute('data-spatial-item', '');
        btn.textContent = b.name;
        if (b.id === state.book) {
          btn.classList.add('is-active');
          activeBtn = btn;
        }
        btn.addEventListener('click', () => {
          closePickerWithSelection();
          loadPassage({
            translation: state.translation,
            book: b.id,
            chapter: 1,
            verse: 1
          });
        });
        grid.appendChild(btn);
      }

      wrapper.append(heading, grid);
      container.appendChild(wrapper);
    }

    return activeBtn;
  });
}

function openChapterPicker() {
  const bookMeta = getBookMeta(state.book);
  openPickerModal(`${bookMeta.name} — Select Chapter`, (container) => {
    const grid = document.createElement('div');
    grid.className = 'picker-grid picker-grid-numbers';
    let activeBtn = null;

    for (let ch = 1; ch <= bookMeta.chapters; ch += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-item';
      btn.setAttribute('data-spatial-item', '');
      btn.textContent = String(ch);
      if (ch === state.chapter) {
        btn.classList.add('is-active');
        activeBtn = btn;
      }
      btn.addEventListener('click', () => {
        closePickerWithSelection();
        loadPassage({
          translation: state.translation,
          book: state.book,
          chapter: ch,
          verse: 1
        });
      });
      grid.appendChild(btn);
    }

    container.appendChild(grid);
    return activeBtn;
  });
}

function openVersePicker() {
  const bookMeta = getBookMeta(state.book);
  const verses = state.currentChapterData?.verses || [];
  const currentSpread = state.spreads[state.spreadIndex];
  const currentAnchor = currentSpread ? currentSpread.startVerse : state.verse;

  openPickerModal(`${bookMeta.name} ${state.chapter} — Select Verse`, (container) => {
    const grid = document.createElement('div');
    grid.className = 'picker-grid picker-grid-numbers';
    let activeBtn = null;

    for (const item of verses) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-item';
      btn.setAttribute('data-spatial-item', '');
      btn.textContent = String(item.v);
      if (item.v === currentAnchor) {
        btn.classList.add('is-active');
        activeBtn = btn;
      }
      btn.addEventListener('click', () => {
        closePickerWithSelection();
        if (highlightTimer) clearTimeout(highlightTimer);
        state.highlightedVerse = item.v;
        state.verse = item.v;
        state.spreadIndex = findSpreadIndexForVerse(state.spreads, item.v);
        renderCurrentSpread();
        saveReadingState(state);

        highlightTimer = setTimeout(() => {
          state.highlightedVerse = null;
          for (const el of spreadGrid.querySelectorAll('.verse-item.is-highlighted')) {
            el.classList.remove('is-highlighted');
          }
        }, 2400);
      });
      grid.appendChild(btn);
    }

    container.appendChild(grid);
    return activeBtn;
  });
}

// ============================================================================
// Event Wiring & Google TV Remote Integration
// ============================================================================

function setupDialogBehavior() {
  // Light-dismiss fallback for browsers without native `<dialog closedby="any">` support
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    pickerDialog.addEventListener('click', (event) => {
      if (event.target !== pickerDialog) return;
      const rect = pickerDialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      pickerDialog.close();
    });
  }

  // Reset returnValue on close; only move focus to reading stage when a passage was chosen
  pickerDialog.addEventListener('close', () => {
    const reason = pickerDialog.returnValue;
    pickerDialog.returnValue = '';
    if (reason === 'selected') {
      readingStage.focus();
    }
  });

  attachSpatialNavigation(pickerDialog, { selector: '[data-spatial-item]' });
}

function setupControlsAndRemote() {
  btnTranslation.addEventListener('click', openTranslationPicker);
  btnBook.addEventListener('click', openBookPicker);
  btnChapter.addEventListener('click', openChapterPicker);
  btnVerse.addEventListener('click', openVersePicker);

  btnFontDown.addEventListener('click', () => {
    const anchor = state.spreads[state.spreadIndex]?.startVerse || state.verse;
    applyFontScale(state.fontScale - 0.1);
    paginateCurrentChapter({ targetVerse: anchor });
  });

  btnFontUp.addEventListener('click', () => {
    const anchor = state.spreads[state.spreadIndex]?.startVerse || state.verse;
    applyFontScale(state.fontScale + 0.1);
    paginateCurrentChapter({ targetVerse: anchor });
  });

  btnTheme.addEventListener('click', () => {
    toggleColorScheme();
  });

  edgePrev.addEventListener('click', () => {
    goPrevSpread();
    readingStage.focus();
  });

  edgeNext.addEventListener('click', () => {
    goNextSpread();
    readingStage.focus();
  });

  // Top Bar Spatial Navigation: ArrowDown returns focus to the scripture reading stage
  attachSpatialNavigation(topBar, {
    selector: '[data-spatial-item]',
    onBoundaryMiss(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        readingStage.focus();
      }
    }
  });

  topBar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'GoBack') {
      e.preventDefault();
      readingStage.focus();
    }
  });

  // Global Reading Mode D-Pad Listener (Left / Right page turns, Up focuses Top Bar)
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (pickerDialog.open) return;
    if (topBar.contains(document.activeElement)) return;

    const key = e.key;
    if (key === 'ArrowRight' || e.keyCode === 39) {
      e.preventDefault();
      goNextSpread();
    } else if (key === 'ArrowLeft' || e.keyCode === 37) {
      e.preventDefault();
      goPrevSpread();
    } else if (key === 'ArrowUp' || e.keyCode === 38) {
      e.preventDefault();
      const activeTopControl =
        topBar.querySelector('[data-spatial-item][tabindex="0"]') || btnBook;
      setRovingActive(topBar, '[data-spatial-item]', activeTopControl, {
        focus: true,
        scroll: false
      });
    }
  });

  // Re-paginate cleanly on viewport resize (keeping current top-left verse anchored)
  let resizeFrame = null;
  const resizeObserver = new ResizeObserver(() => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (!state.currentChapterData) return;
      const anchor = state.spreads[state.spreadIndex]?.startVerse || state.verse;
      paginateCurrentChapter({ targetVerse: anchor });
    });
  });
  resizeObserver.observe(spreadGrid);
}

// ============================================================================
// Bootstrap
// ============================================================================

async function init() {
  initColorSchemeSync();
  applyFontScale(state.fontScale);
  setupDialogBehavior();
  setupControlsAndRemote();

  try {
    const translations = await fetchTranslations();
    if (translations.length === 0) {
      showStatusMessage('No Bible translations found on server.');
      return;
    }

    const exists = translations.some((t) => t.id === state.translation);
    if (!exists) {
      state.translation = translations[0].id;
    }

    await loadPassage({
      translation: state.translation,
      book: state.book,
      chapter: state.chapter,
      verse: state.verse
    });

    readingStage.focus();
  } catch (err) {
    showStatusMessage(`Failed initializing Bible Reader: ${err.message}`);
  }
}

init();

