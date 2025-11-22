/* Carousel Module - Virtual scrolling infinite carousel */

import type { Experience } from '../types';
import { openInNewTab } from '../utils.js';

// Track recent drag to prevent clicks
let justDraggedUntil = 0;

// Store filtered experiences for virtual scrolling
let filteredExperiences: Experience[] = [];

// Generate empty carousel container (cards created dynamically)
export function generateCarousel(_experiences: Experience[]): string {
  return ''; // Virtual scrolling will create cards dynamically
}

// Initialize carousel with virtual scrolling and drag support
export function initializeCarousel(experiences: Experience[]): void {
  filteredExperiences = [...experiences];
  
  const track = document.querySelector('.scroller__track') as HTMLElement | null;
  const scroller = document.querySelector('.scroller') as HTMLElement | null;
  
  if (!track || !scroller || filteredExperiences.length === 0) return;

  // Constants
  const CARD_WIDTH = 340;
  const GAP = 32;
  const ITEM_WIDTH = CARD_WIDTH + GAP;
  const SCROLL_SPEED_PX_PER_SEC = 80;
  const VISIBLE_BUFFER = 2; // Extra cards on each side
  const DRAG_THRESHOLD = 6;
  const MAX_DELTA_TIME = 0.1;

  // Virtual scrolling state
  let scrollPosition = 0; // Virtual scroll position (continuously growing)
  let lastTs = 0;
  let draggingScroller = false;
  let maybeDrag = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  
  // Card pool for reuse
  const cardPool: HTMLElement[] = [];
  const activeCards = new Map<number, HTMLElement>();

  // Setup track for absolute positioning
  track.style.position = 'relative';
  track.style.height = '220px';
  track.style.overflow = 'visible';
  track.style.animation = 'none';

  // Create or reuse a card element
  const getOrCreateCard = (): HTMLElement => {
    let card = cardPool.pop();
    if (!card) {
      card = document.createElement('article');
      card.className = 'xp-card';
      card.style.position = 'absolute';
      card.style.top = '0';
      card.style.width = `${CARD_WIDTH}px`;
      
      const img = document.createElement('img');
      img.draggable = false;
      card.appendChild(img);
      
      const label = document.createElement('div');
      label.className = 'xp-card__label';
      card.appendChild(label);
    }
    return card;
  };

  // Return card to pool
  const recycleCard = (card: HTMLElement) => {
    card.remove();
    cardPool.push(card);
  };

  // Update card with experience data
  const updateCard = (card: HTMLElement, exp: Experience, virtualIndex: number) => {
    const img = card.querySelector('img') as HTMLImageElement;
    const label = card.querySelector('.xp-card__label') as HTMLElement;
    
    img.src = exp.image;
    img.alt = exp.alt;
    label.textContent = exp.title;
    
    card.dataset.tags = JSON.stringify(exp.tags);
    card.dataset.url = exp.url;
    card.dataset.virtualIndex = String(virtualIndex);
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');

    // Attach click handler if not already present
    if (!card.dataset.hasClickHandler) {
      card.addEventListener('click', () => {
        if (Date.now() < justDraggedUntil) return;
        openInNewTab(card.dataset.url || 'https://www.google.com');
      });
      card.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openInNewTab(card.dataset.url || 'https://www.google.com');
        }
      });
      card.dataset.hasClickHandler = 'true';
    }
  };

  // Update visible cards based on scroll position
  const updateVisibleCards = () => {
    if (filteredExperiences.length === 0) {
      activeCards.forEach(card => recycleCard(card));
      activeCards.clear();
      return;
    }

    const viewportWidth = scroller.getBoundingClientRect().width;
    
    // Calculate which virtual indices should be visible
    const startIndex = Math.floor(scrollPosition / ITEM_WIDTH) - VISIBLE_BUFFER;
    const endIndex = Math.ceil((scrollPosition + viewportWidth) / ITEM_WIDTH) + VISIBLE_BUFFER;
    
    const neededIndices = new Set<number>();
    for (let i = startIndex; i <= endIndex; i++) {
      neededIndices.add(i);
    }
    
    // Remove cards that are no longer visible
    activeCards.forEach((card, idx) => {
      if (!neededIndices.has(idx)) {
        recycleCard(card);
        activeCards.delete(idx);
      }
    });
    
    // Update positions of all active cards
    activeCards.forEach((card, idx) => {
      card.style.left = `${idx * ITEM_WIDTH - scrollPosition}px`;
    });
    
    // Add newly visible cards
    neededIndices.forEach(virtualIndex => {
      if (activeCards.has(virtualIndex)) return;
      
      // Get the experience for this index (wrap around)
      const expIndex = ((virtualIndex % filteredExperiences.length) + filteredExperiences.length) % filteredExperiences.length;
      const exp = filteredExperiences[expIndex];
      
      // Get or create card element
      const card = getOrCreateCard();
      updateCard(card, exp, virtualIndex);
      
      // Position card
      card.style.left = `${virtualIndex * ITEM_WIDTH - scrollPosition}px`;
      
      activeCards.set(virtualIndex, card);
      track.appendChild(card);
    });
  };

  // Animation loop
  const tick = (ts: number) => {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    dt = Math.min(dt, MAX_DELTA_TIME);
    lastTs = ts;
    
    if (!draggingScroller && dt > 0 && filteredExperiences.length > 0) {
      scrollPosition += SCROLL_SPEED_PX_PER_SEC * dt;
      updateVisibleCards();
    }
    requestAnimationFrame(tick);
  };

  // Initialize
  updateVisibleCards();
  requestAnimationFrame(tick);

  // Drag handlers
  const onPointerDown = (e: PointerEvent) => {
    maybeDrag = true;
    draggingScroller = false;
    dragStartX = e.clientX;
    dragStartScroll = scrollPosition;
  };

  const onPointerMove = (e: PointerEvent) => {
    const dx = e.clientX - dragStartX;
    if (!draggingScroller) {
      if (!maybeDrag) return;
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      draggingScroller = true;
      // Prevent page scrolling during carousel drag
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      try { scroller.setPointerCapture?.(e.pointerId); } catch {}
    }
    scrollPosition = dragStartScroll - dx;
    updateVisibleCards();
    e.preventDefault();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (draggingScroller) {
      justDraggedUntil = Date.now() + 100;
      // Re-enable page scrolling
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      try { scroller.releasePointerCapture?.(e.pointerId); } catch {}
    }
    maybeDrag = false;
    draggingScroller = false;
  };

  scroller.addEventListener('pointerdown', onPointerDown);
  scroller.addEventListener('pointermove', onPointerMove);
  scroller.addEventListener('pointerup', onPointerUp);
  scroller.addEventListener('pointercancel', onPointerUp);

  // Tag filtering
  const applyFilter = (tag: string) => {
    if (tag === 'all') {
      filteredExperiences = [...experiences];
    } else {
      filteredExperiences = experiences.filter(exp => 
        exp.tags.some(t => t.toLowerCase() === tag.toLowerCase())
      );
    }
    
    // Clear and re-render
    activeCards.forEach(card => recycleCard(card));
    activeCards.clear();
    scrollPosition = 0;
    updateVisibleCards();
  };

  const tagBtns = document.querySelectorAll<HTMLElement>('.chip');
  tagBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tagBtns.forEach((b) => b.classList.remove('chip--active'));
      btn.classList.add('chip--active');
      const selectedTag = btn.dataset.tag || 'all';
      applyFilter(selectedTag);
    });
  });
}

// Setup click handlers for carousel cards (no longer needed - handled inline)
export function setupCarouselCardInteractions(): void {
  // Click handlers are now attached during card creation in updateVisibleCards
}
