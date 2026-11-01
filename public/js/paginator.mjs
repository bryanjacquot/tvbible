/**
 * Two-Column Open-Book Verse Paginator
 * Packs complete verses into left and right side-by-side columns with zero vertical scrolling.
 */

/**
 * Pure packing algorithm: given verses and their measured pixel heights, pack into two-column spreads.
 * @param {Array<{v: number, t: string}>} verses
 * @param {number[]} heights - Rendered pixel height of each verse element
 * @param {number} maxColumnHeight - Available height of a single column in px
 * @param {number} rowGap - Vertical gap between consecutive verses in px
 */
export function packVersesIntoSpreads(verses, heights, maxColumnHeight, rowGap = 0) {
  if (!Array.isArray(verses) || verses.length === 0) {
    return [];
  }

  const safeMax = Math.max(80, maxColumnHeight);
  const spreads = [];
  let cursor = 0;

  while (cursor < verses.length) {
    const leftVerses = [];
    const rightVerses = [];

    // Fill Left Column (always place at least 1 verse in left column to guarantee forward progress)
    let leftUsed = 0;
    while (cursor < verses.length) {
      const h = heights[cursor] || 40;
      const gap = leftVerses.length > 0 ? rowGap : 0;
      if (leftVerses.length > 0 && leftUsed + gap + h > safeMax) {
        break;
      }
      leftVerses.push(verses[cursor]);
      leftUsed += gap + h;
      cursor += 1;
      // If a single extraordinarily long verse already exceeded column height, move to right column next
      if (leftUsed >= safeMax) break;
    }

    // Fill Right Column
    let rightUsed = 0;
    while (cursor < verses.length) {
      const h = heights[cursor] || 40;
      const gap = rightVerses.length > 0 ? rowGap : 0;
      if (rightUsed + gap + h > safeMax) {
        break;
      }
      rightVerses.push(verses[cursor]);
      rightUsed += gap + h;
      cursor += 1;
    }

    const combined = [...leftVerses, ...rightVerses];
    spreads.push({
      index: spreads.length,
      startVerse: combined[0].v,
      endVerse: combined[combined.length - 1].v,
      leftVerses,
      rightVerses
    });
  }

  return spreads;
}

/**
 * Find the spread index containing `targetVerse` (or closest matching spread).
 */
export function findSpreadIndexForVerse(spreads, targetVerse) {
  if (!Array.isArray(spreads) || spreads.length === 0) return 0;
  const v = Number(targetVerse) || 1;
  for (let i = 0; i < spreads.length; i += 1) {
    if (v >= spreads[i].startVerse && v <= spreads[i].endVerse) {
      return i;
    }
  }
  if (v < spreads[0].startVerse) return 0;
  // Find last spread whose startVerse <= v
  for (let i = spreads.length - 1; i >= 0; i -= 1) {
    if (spreads[i].startVerse <= v) return i;
  }
  return spreads.length - 1;
}

/**
 * Create a DOM `<p class="verse-item">` element for rendering or measurement.
 */
export function createVerseElement(verseObj, highlightedVerse = null) {
  const p = document.createElement('p');
  p.className = 'verse-item';
  p.dataset.verse = String(verseObj.v);
  if (highlightedVerse != null && Number(highlightedVerse) === verseObj.v) {
    p.classList.add('is-highlighted');
  }

  const num = document.createElement('span');
  num.className = 'verse-num';
  num.textContent = String(verseObj.v);

  p.append(num, document.createTextNode(verseObj.t));
  return p;
}

/**
 * Measure all verses in a single layout pass inside `measureColumn` and compute two-column spreads.
 */
export function measureAndPaginateChapter({ verses, measureHost, measureColumn, colLeft, spreadGrid }) {
  const gridStyles = window.getComputedStyle(spreadGrid);
  const padTop = parseFloat(gridStyles.paddingTop) || 0;
  const padBottom = parseFloat(gridStyles.paddingBottom) || 0;
  const maxColumnHeight = Math.max(120, spreadGrid.clientHeight - padTop - padBottom - 4);

  const colWidth = colLeft.clientWidth || Math.floor((spreadGrid.clientWidth - 48) / 2);
  measureHost.style.width = `${colWidth}px`;

  const colStyles = window.getComputedStyle(measureColumn);
  const rowGap = parseFloat(colStyles.rowGap || colStyles.gap) || 0;

  const frag = document.createDocumentFragment();
  const nodes = verses.map((v) => {
    const el = createVerseElement(v);
    frag.appendChild(el);
    return el;
  });

  measureColumn.replaceChildren(frag);
  // Single synchronous layout read across all appended nodes
  const heights = nodes.map((el) => el.getBoundingClientRect().height);
  measureColumn.replaceChildren();

  return packVersesIntoSpreads(verses, heights, maxColumnHeight, rowGap);
}

