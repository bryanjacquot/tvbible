/**
 * Accessible 2D Directional (D-Pad / Arrow Key) Spatial Navigation
 * Implements roving tabindex and live bounding-box candidate selection.
 */

const SUBPIXEL_TOLERANCE = 2;
const PERP_WEIGHT = 2.5;

/**
 * Pure geometry selector for testing and live DOM spatial navigation.
 * @param {{top:number,right:number,bottom:number,left:number}} current
 * @param {Array<{item: any, rect: {top:number,right:number,bottom:number,left:number}}>} entries
 * @param {'ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown'} key
 */
export function pickSpatialCandidate(current, entries, key) {
  const curCenterX = (current.left + current.right) / 2;
  const curCenterY = (current.top + current.bottom) / 2;

  const overlapping = [];
  const nonOverlapping = [];

  for (const entry of entries) {
    const r = entry.rect;
    let inDirection = false;
    let gap = 0;
    let overlapsPerp = false;
    let perpOffset = 0;

    switch (key) {
      case 'ArrowRight':
        inDirection = r.left >= current.right - SUBPIXEL_TOLERANCE;
        gap = Math.max(0, r.left - current.right);
        overlapsPerp = Math.min(current.bottom, r.bottom) > Math.max(current.top, r.top);
        perpOffset = Math.abs((r.top + r.bottom) / 2 - curCenterY);
        break;
      case 'ArrowLeft':
        inDirection = r.right <= current.left + SUBPIXEL_TOLERANCE;
        gap = Math.max(0, current.left - r.right);
        overlapsPerp = Math.min(current.bottom, r.bottom) > Math.max(current.top, r.top);
        perpOffset = Math.abs((r.top + r.bottom) / 2 - curCenterY);
        break;
      case 'ArrowDown':
        inDirection = r.top >= current.bottom - SUBPIXEL_TOLERANCE;
        gap = Math.max(0, r.top - current.bottom);
        overlapsPerp = Math.min(current.right, r.right) > Math.max(current.left, r.left);
        perpOffset = Math.abs((r.left + r.right) / 2 - curCenterX);
        break;
      case 'ArrowUp':
        inDirection = r.bottom <= current.top + SUBPIXEL_TOLERANCE;
        gap = Math.max(0, current.top - r.bottom);
        overlapsPerp = Math.min(current.right, r.right) > Math.max(current.left, r.left);
        perpOffset = Math.abs((r.left + r.right) / 2 - curCenterX);
        break;
      default:
        return null;
    }

    if (!inDirection) continue;

    if (overlapsPerp) {
      overlapping.push({ item: entry.item, gap, perpOffset });
    } else {
      nonOverlapping.push({
        item: entry.item,
        score: gap + PERP_WEIGHT * perpOffset
      });
    }
  }

  if (overlapping.length > 0) {
    overlapping.sort((a, b) => a.gap - b.gap || a.perpOffset - b.perpOffset);
    return overlapping[0].item;
  }

  if (nonOverlapping.length > 0) {
    nonOverlapping.sort((a, b) => a.score - b.score);
    return nonOverlapping[0].item;
  }

  return null;
}

/**
 * Set roving tabindex so `activeEl` has tabindex="0" and all siblings have tabindex="-1".
 */
export function setRovingActive(container, selector, activeEl, { focus = false, scroll = true } = {}) {
  const all = Array.from(container.querySelectorAll(selector));
  if (all.length === 0) return null;
  const target = activeEl && all.includes(activeEl) ? activeEl : all[0];

  for (const el of all) {
    el.setAttribute('tabindex', el === target ? '0' : '-1');
  }
  if (focus) {
    target.focus();
    if (scroll && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  return target;
}

/**
 * Attach spatial arrow-key navigation to a composite widget container.
 */
export function attachSpatialNavigation(container, { selector = '[data-spatial-item]', onBoundaryMiss } = {}) {
  container.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;

    const innerTarget = e.composedPath()[0];
    if (
      innerTarget instanceof Element &&
      innerTarget.matches(':read-write, select, input[type="range"], [role="slider"]')
    ) {
      return;
    }

    const candidates = Array.from(container.querySelectorAll(selector)).filter((el) => {
      if (el.disabled) return false;
      return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
    });

    const active = document.activeElement;
    if (!candidates.includes(active)) return;

    const currentRect = active.getBoundingClientRect();
    const otherEntries = candidates
      .filter((el) => el !== active)
      .map((el) => ({ item: el, rect: el.getBoundingClientRect() }));

    const nextEl = pickSpatialCandidate(currentRect, otherEntries, e.key);
    if (nextEl) {
      e.preventDefault();
      setRovingActive(container, selector, nextEl, { focus: true, scroll: true });
      return;
    }

    if (typeof onBoundaryMiss === 'function') {
      onBoundaryMiss(e, active);
    }
    // Note: when no candidate exists and onBoundaryMiss does not handle it,
    // we intentionally do NOT call e.preventDefault() so native scrolling continues.
  });

  // Keep roving tabindex synchronized on pointer click/focus
  container.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target instanceof Element && target.matches(selector)) {
      setRovingActive(container, selector, target, { focus: false });
    }
  });
}

