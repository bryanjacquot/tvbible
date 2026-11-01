const STORAGE_KEY = 'tvbible_reader_v1';
const COLOR_SCHEME_KEY = 'color-scheme';

export const DEFAULT_READING_STATE = {
  version: 1,
  translation: 'BSB',
  book: 'GEN',
  chapter: 1,
  verse: 1,
  fontScale: 1
};

export function clampFontScale(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 1;
  return Math.round(Math.min(1.5, Math.max(0.8, num)) * 100) / 100;
}

export function loadReadingState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_READING_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_READING_STATE };
    }
    return {
      version: 1,
      translation: typeof parsed.translation === 'string' && parsed.translation ? parsed.translation : 'BSB',
      book: typeof parsed.book === 'string' && parsed.book ? parsed.book : 'GEN',
      chapter: Number.isInteger(parsed.chapter) && parsed.chapter >= 1 ? parsed.chapter : 1,
      verse: Number.isInteger(parsed.verse) && parsed.verse >= 1 ? parsed.verse : 1,
      fontScale: clampFontScale(parsed.fontScale ?? 1)
    };
  } catch {
    return { ...DEFAULT_READING_STATE };
  }
}

export function saveReadingState(state) {
  try {
    const payload = {
      version: 1,
      translation: state.translation,
      book: state.book,
      chapter: Number(state.chapter) || 1,
      verse: Number(state.verse) || 1,
      fontScale: clampFontScale(state.fontScale),
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or restricted-mode errors gracefully
  }
}

function getSystemScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyMetaColorScheme(storedValue) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (!meta) return;
  meta.content = storedValue === 'dark' || storedValue === 'light' ? storedValue : 'light dark';
}

export function toggleColorScheme() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(COLOR_SCHEME_KEY);
  } catch {}

  const systemScheme = getSystemScheme();
  const currentRendered = stored === 'dark' || stored === 'light' ? stored : systemScheme;
  const target = currentRendered === 'dark' ? 'light' : 'dark';

  try {
    if (target !== systemScheme) {
      window.localStorage.setItem(COLOR_SCHEME_KEY, target);
      applyMetaColorScheme(target);
    } else {
      window.localStorage.removeItem(COLOR_SCHEME_KEY);
      applyMetaColorScheme(null);
    }
  } catch {
    applyMetaColorScheme(target);
  }
}

export function initColorSchemeSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === COLOR_SCHEME_KEY) {
      applyMetaColorScheme(e.newValue);
    }
  });
}

