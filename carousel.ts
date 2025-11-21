/* Carousel Module - Infinite scrolling experience carousel */

import type { Experience } from './types';
import { openInNewTab } from './utils.js';

// Track recent drag to prevent clicks
let justDraggedUntil = 0;

// Generate carousel HTML
export function generateCarousel(experiences: Experience[]): string {
  return experiences.map(exp => {
    const tagsJson = JSON.stringify(exp.tags);
    return `
      <article class="xp-card" data-tags='${tagsJson}' data-url="${exp.url}">
        <img src="${exp.image}" alt="${exp.alt}" />
        <div class="xp-card__label">${exp.title}</div>
      </article>
    `;
  }).join('');
}

// Initialize carousel with infinite scrolling and drag support
export function initializeCarousel(): void {
  const track = document.querySelector('.scroller__track') as HTMLElement | null;
  const scroller = document.querySelector('.scroller') as HTMLElement | null;
  
  if (!track || !scroller) return;

  const originalChildren = Array.from(track.children) as HTMLElement[];
  // Store originals with data attribute to distinguish from duplicates
  originalChildren.forEach((el) => { el.dataset.original = 'true'; });
  // Duplicate once for 50% translateX end
  originalChildren.forEach((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    delete clone.dataset.original;
    track.appendChild(clone);
  });

  const SCROLL_SPEED_PX_PER_SEC = 80; // matches duration calc baseline

  const recalculateDuration = () => {
    requestAnimationFrame(() => {
      const GAP = 32; // match CSS scroller__track gap
      const visibleCards = Array.from(track.children).filter((el) => !(el as HTMLElement).classList.contains('hidden')) as HTMLElement[];
      const originalVisible = visibleCards.filter((el) => el.dataset.original === 'true');
      const totalWidth = originalVisible.reduce((acc, el) => acc + el.getBoundingClientRect().width + GAP, 0);
      const duration = Math.max(28, Math.min(60, totalWidth / SCROLL_SPEED_PX_PER_SEC));
      (track as HTMLElement).style.setProperty('--duration', `${duration}s`);
    });
  };

  recalculateDuration();

  // JS-driven carousel scrolling with drag-to-pan support
  let offsetX = 0;
  let lastTs = 0;
  let draggingScroller = false;
  let maybeDrag = false;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let loopWidth = 0;
  const DRAG_THRESHOLD = 6; // px

  const computeLoopWidth = () => {
    const GAP = 32; // match CSS scroller__track gap
    const visibleCards = Array.from(track.children).filter((el) => !(el as HTMLElement).classList.contains('hidden')) as HTMLElement[];
    const originalVisible = visibleCards.filter((el) => el.dataset.original === 'true');
    const total = originalVisible.reduce((acc, el) => acc + el.getBoundingClientRect().width + GAP, 0);
    loopWidth = Math.max(1, total);
  };

  const applyTransform = () => {
    (track as HTMLElement).style.transform = `translateX(${offsetX}px)`;
  };

  const wrapOffset = () => {
    if (offsetX <= -loopWidth) offsetX += loopWidth;
    if (offsetX > 0) offsetX -= loopWidth;
  };

  const tick = (ts: number) => {
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!draggingScroller) {
      offsetX -= SCROLL_SPEED_PX_PER_SEC * dt;
      wrapOffset();
      applyTransform();
    }
    requestAnimationFrame(tick);
  };

  // Handle window resize
  const onResize = () => {
    computeLoopWidth();
    wrapOffset();
    applyTransform();
  };
  window.addEventListener('resize', onResize);

  // Disable CSS animation to avoid conflicts; we drive transform via JS
  (track as HTMLElement).style.animation = 'none';

  computeLoopWidth();
  applyTransform();
  requestAnimationFrame(tick);

  const onPointerDown = (e: PointerEvent) => {
    maybeDrag = true;
    draggingScroller = false;
    dragStartX = e.clientX;
    dragStartOffset = offsetX;
    // Do not prevent default here to allow clicks
  };

  const onPointerMove = (e: PointerEvent) => {
    const dx = e.clientX - dragStartX;
    if (!draggingScroller) {
      if (!maybeDrag) return;
      if (Math.abs(dx) < DRAG_THRESHOLD) return; // not a drag yet
      draggingScroller = true;
      try { (track as HTMLElement).setPointerCapture?.((e as PointerEvent).pointerId); } catch {}
    }
    // While dragging, update position and prevent default scroll
    offsetX = dragStartOffset + dx;
    wrapOffset();
    applyTransform();
    e.preventDefault();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (draggingScroller) {
      justDraggedUntil = Date.now() + 100;
      try { (track as HTMLElement).releasePointerCapture?.((e as PointerEvent).pointerId); } catch {}
    }
    maybeDrag = false;
    draggingScroller = false;
  };

  scroller.addEventListener('pointerdown', onPointerDown);
  scroller.addEventListener('pointermove', onPointerMove);
  scroller.addEventListener('pointerup', onPointerUp);
  scroller.addEventListener('pointercancel', onPointerUp);

  // Tag filtering
  const setupTagFilters = () => {
    const tagBtns = document.querySelectorAll<HTMLElement>('.tag-btn');
    if (tagBtns.length === 0) return;

    tagBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tagBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const selectedTag = btn.dataset.tag || 'all';
        const allCards = document.querySelectorAll<HTMLElement>('.xp-card');
        
        allCards.forEach((card) => {
          const cardTags: string[] = card.dataset.tags ? JSON.parse(card.dataset.tags) : [];
          const cardTagsLower = cardTags.map(t => t.toLowerCase());
          if (selectedTag === 'all' || cardTagsLower.includes(selectedTag.toLowerCase())) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });

        // Recalculate animation duration based on visible cards
        recalculateDuration();
        // Update loop width to reflect visible items and keep position stable
        onResize();
      });
    });
  };

  setupTagFilters();
}

// Setup click handlers for carousel cards
export function setupCarouselCardInteractions(): void {
  document.querySelectorAll<HTMLElement>('.xp-card').forEach((card) => {
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    const url = card.dataset.url || 'https://www.google.com';
    card.addEventListener('click', (e) => {
      if (Date.now() < justDraggedUntil) {
        e.preventDefault();
        return;
      }
      openInNewTab(url);
    });
    card.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openInNewTab(url);
      }
    });
  });
}
