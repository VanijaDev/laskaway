/* Carousel Module - Virtual scrolling infinite carousel */

import type { Experience } from '../../types';
import { openInNewTab } from '../../utils.js';

// Constants
const CARD_WIDTH = 340;
const GAP = 32;
const ITEM_WIDTH = CARD_WIDTH + GAP;
const SCROLL_SPEED_PX_PER_SEC = 80;
const VISIBLE_BUFFER = 2;
const MAX_DELTA_TIME = 0.1;
const TRACK_HEIGHT = '220px';
const DEFAULT_URL = 'https://www.google.com';
const MAX_INERTIA_VELOCITY_PX_PER_MS = 1.2; // 1200px/s

// Initialize carousel with virtual scrolling
export function initializeCarousel(experiences: Experience[]): void {
  const track = document.querySelector('.scroller__track') as HTMLElement | null;
  const scroller = document.querySelector('.scroller') as HTMLElement | null;
  
  if (!track || !scroller || experiences.length === 0) return;

  const carousel = new VirtualCarousel(track, scroller, experiences);
  carousel.initialize();
}

class VirtualCarousel {
  private readonly track: HTMLElement;
  private readonly scroller: HTMLElement;
  private readonly experiences: Experience[];
  private readonly isDesktopHover: boolean;
  private filteredExperiences: Experience[];
  
  private scrollPosition = 0;
  private lastTimestamp = 0;
  private isAutoScrollPaused = false;

  private isPointerDown = false;
  private isUserDragging = false;
  private dragStartX = 0;
  private dragStartScrollPosition = 0;
  private suppressClickUntil = 0;

  private lastPointerMoveX = 0;
  private lastPointerMoveAt = 0;
  private dragVelocityPxPerMs = 0;
  private inertiaRafId: number | null = null;
  
  private readonly cardPool: HTMLElement[] = [];
  private readonly activeCards = new Map<number, HTMLElement>();

  constructor(track: HTMLElement, scroller: HTMLElement, experiences: Experience[]) {
    this.track = track;
    this.scroller = scroller;
    this.experiences = experiences;
    this.filteredExperiences = [...experiences];
    this.isDesktopHover = window.matchMedia('(hover: hover)').matches;
  }

  initialize(): void {
    this.setupTrack();
    this.updateVisibleCards();
    this.setupUserScrolling();
    this.startAnimationLoop();
    this.setupTagFiltering();
    document.addEventListener('visibilitychange', () => {
      this.isAutoScrollPaused = document.hidden;
    }, { passive: true });
  }

  private setupTrack(): void {
    this.track.style.position = 'relative';
    this.track.style.height = TRACK_HEIGHT;
    this.track.style.overflow = 'visible';
    this.track.style.animation = 'none';
  }

  private pauseAutoScroll = (): void => {
    this.isAutoScrollPaused = true;
  };

  private resumeAutoScroll = (): void => {
    this.isAutoScrollPaused = false;
  };

  private stopInertia(): void {
    if (this.inertiaRafId !== null) {
      cancelAnimationFrame(this.inertiaRafId);
      this.inertiaRafId = null;
    }
  }

  private startInertia(initialVelocityPxPerMs: number): void {
    this.stopInertia();
    this.pauseAutoScroll();

    let velocity = Math.max(
      -MAX_INERTIA_VELOCITY_PX_PER_MS,
      Math.min(MAX_INERTIA_VELOCITY_PX_PER_MS, initialVelocityPxPerMs)
    );
    let lastAt = performance.now();

    // Apply one immediate step so inertia starts without a visible pause.
    // This avoids waiting for the next animation frame to see movement.
    {
      const dt = 16;
      const friction = 0.0025; // 1/ms
      velocity *= Math.exp(-friction * dt);
      this.scrollPosition += velocity * dt;
      this.updateVisibleCards();
    }

    const tick = (now: number): void => {
      const dt = Math.min(32, Math.max(0, now - lastAt));
      lastAt = now;

      // Exponential decay (ease-out feel).
      const friction = 0.0025; // 1/ms
      velocity *= Math.exp(-friction * dt);

      this.scrollPosition += velocity * dt;
      this.updateVisibleCards();

      if (Math.abs(velocity) < 0.02) {
        this.inertiaRafId = null;
        this.resumeAutoScroll();
        return;
      }

      this.inertiaRafId = requestAnimationFrame(tick);
    };

    this.inertiaRafId = requestAnimationFrame(tick);
  }

  private handleScrollerPointerDown = (e: PointerEvent): void => {
    // Only left mouse / primary touch.
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    this.stopInertia();

    this.startDrag(e.clientX, e.timeStamp);

    this.scroller.style.cursor = 'grabbing';

    // Listen on window so dragging continues even if pointer leaves the scroller.
    // Do NOT use pointer capture here: it breaks card click targeting.
    window.addEventListener('pointermove', this.handleScrollerPointerMove, { passive: false });
    window.addEventListener('pointerup', this.handleScrollerPointerUp);
    window.addEventListener('pointercancel', this.handleScrollerPointerUp);
  };

  private handleScrollerPointerMove = (e: PointerEvent): void => {
    this.updateDrag(e.clientX, e.timeStamp, () => {
      if (e.cancelable) e.preventDefault();
    });
  };

  private handleScrollerPointerUp = (e: PointerEvent): void => {
    this.finishDrag(e.clientX, e.timeStamp);

    window.removeEventListener('pointermove', this.handleScrollerPointerMove);
    window.removeEventListener('pointerup', this.handleScrollerPointerUp);
    window.removeEventListener('pointercancel', this.handleScrollerPointerUp);
  };

  private handleLegacyMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this.stopInertia();

    this.startDrag(e.clientX, e.timeStamp);

    window.addEventListener('mousemove', this.handleLegacyMouseMove);
    window.addEventListener('mouseup', this.handleLegacyMouseUp);
  };

  private handleLegacyMouseMove = (e: MouseEvent): void => {
    this.updateDrag(e.clientX, e.timeStamp, () => {
      if (e.cancelable) e.preventDefault();
    });
  };

  private handleLegacyMouseUp = (e: MouseEvent): void => {
    this.finishDrag(e.clientX, e.timeStamp);
    window.removeEventListener('mousemove', this.handleLegacyMouseMove);
    window.removeEventListener('mouseup', this.handleLegacyMouseUp);
  };

  private handleLegacyTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    this.stopInertia();

    this.startDrag(touch.clientX, e.timeStamp);

    window.addEventListener('touchmove', this.handleLegacyTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleLegacyTouchEnd);
    window.addEventListener('touchcancel', this.handleLegacyTouchEnd);
  };

  private handleLegacyTouchMove = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    this.updateDrag(touch.clientX, e.timeStamp, () => {
      if (e.cancelable) e.preventDefault();
    });
  };

  private handleLegacyTouchEnd = (e: TouchEvent): void => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    this.finishDrag(touch.clientX, e.timeStamp);
    window.removeEventListener('touchmove', this.handleLegacyTouchMove);
    window.removeEventListener('touchend', this.handleLegacyTouchEnd);
    window.removeEventListener('touchcancel', this.handleLegacyTouchEnd);
  };

  private startDrag(clientX: number, timeStamp: number): void {
    this.isPointerDown = true;
    this.isUserDragging = false;
    this.dragStartX = clientX;
    this.dragStartScrollPosition = this.scrollPosition;
    this.pauseAutoScroll();

    this.lastPointerMoveX = clientX;
    this.lastPointerMoveAt = timeStamp;
    this.dragVelocityPxPerMs = 0;
    this.scroller.style.cursor = 'grabbing';
  }

  private updateDrag(clientX: number, timeStamp: number, preventDefault: () => void): void {
    if (!this.isPointerDown) return;

    const deltaX = clientX - this.dragStartX;
    if (!this.isUserDragging && Math.abs(deltaX) > 4) {
      this.isUserDragging = true;
      // iOS Safari can otherwise treat this gesture as page scrolling and
      // throttle/cancel pointer events. Disable native touch handling for the
      // duration of an active drag, then restore on release.
      this.scroller.style.touchAction = 'none';
    }

    const dx = clientX - this.lastPointerMoveX;
    const dt = Math.max(1, timeStamp - this.lastPointerMoveAt);
    const instantVelocity = (-dx) / dt;
    this.dragVelocityPxPerMs = this.dragVelocityPxPerMs * 0.8 + instantVelocity * 0.2;
    this.dragVelocityPxPerMs = Math.max(
      -MAX_INERTIA_VELOCITY_PX_PER_MS,
      Math.min(MAX_INERTIA_VELOCITY_PX_PER_MS, this.dragVelocityPxPerMs)
    );
    this.lastPointerMoveX = clientX;
    this.lastPointerMoveAt = timeStamp;

    if (this.isUserDragging) {
      preventDefault();
    }

    this.scrollPosition = this.dragStartScrollPosition - deltaX;
    this.updateVisibleCards();
  }

  private finishDrag(clientX: number, timeStamp: number): void {
    if (!this.isPointerDown) return;

    this.isPointerDown = false;
    this.scroller.style.cursor = 'grab';
    this.scroller.style.touchAction = 'pan-y';

    if (this.isUserDragging) {
      const finalDeltaX = clientX - this.dragStartX;
      this.scrollPosition = this.dragStartScrollPosition - finalDeltaX;
      this.updateVisibleCards();

      const dx = clientX - this.lastPointerMoveX;
      const dt = timeStamp - this.lastPointerMoveAt;
      if (dt > 0) {
        const instantVelocity = (-dx) / dt;
        this.dragVelocityPxPerMs = this.dragVelocityPxPerMs * 0.5 + instantVelocity * 0.5;
        this.dragVelocityPxPerMs = Math.max(
          -MAX_INERTIA_VELOCITY_PX_PER_MS,
          Math.min(MAX_INERTIA_VELOCITY_PX_PER_MS, this.dragVelocityPxPerMs)
        );
        this.lastPointerMoveX = clientX;
        this.lastPointerMoveAt = timeStamp;
      }

      this.suppressClickUntil = performance.now() + 300;
      this.isUserDragging = false;

      if (Math.abs(this.dragVelocityPxPerMs) >= 0.02) {
        this.startInertia(this.dragVelocityPxPerMs);
        return;
      }
    }

    this.resumeAutoScroll();
  }

  private setupUserScrolling(): void {
    // Keep vertical scrolling on touch devices while enabling horizontal dragging here.
    this.scroller.style.touchAction = 'pan-y';
    this.scroller.style.cursor = 'grab';

    if ('PointerEvent' in window) {
      this.scroller.addEventListener('pointerdown', this.handleScrollerPointerDown);
      return;
    }

    // Fallback for browsers/environments without Pointer Events.
    this.scroller.addEventListener('mousedown', this.handleLegacyMouseDown);
    this.scroller.addEventListener('touchstart', this.handleLegacyTouchStart, { passive: true });
  }

  private createCardElement(): HTMLElement {
    const card = document.createElement('article');
    card.className = 'xp-card';
    card.style.position = 'absolute';
    card.style.top = '0';
    card.style.width = `${CARD_WIDTH}px`;
    card.style.transformOrigin = 'center center';
    
    const img = document.createElement('img');
    img.draggable = false;
    card.appendChild(img);
    
    const label = document.createElement('div');
    label.className = 'xp-card__label';
    card.appendChild(label);
    
    return card;
  }

  private getOrCreateCard(): HTMLElement {
    return this.cardPool.pop() || this.createCardElement();
  }

  private recycleCard(card: HTMLElement): void {
    card.remove();
    this.cardPool.push(card);
  }

  private attachCardHandlers(card: HTMLElement): void {
    if (card.dataset.hasClickHandler) return;

    card.addEventListener('click', (e) => {
      // Prevent accidental click after drag release.
      if (performance.now() < this.suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      openInNewTab(card.dataset.url || DEFAULT_URL);
    });
    card.dataset.hasClickHandler = 'true';

    if (this.isDesktopHover && !card.dataset.hoverBound) {
      card.addEventListener('mouseenter', () => {
        this.pauseAutoScroll();
        card.dataset.hover = '1';
        card.style.transform = 'scale(1.06)';
      });
      card.addEventListener('mouseleave', () => {
        card.dataset.hover = '';
        this.resumeAutoScroll();
        card.style.transform = '';
      });
      card.dataset.hoverBound = 'true';
    }
  }

  private updateCardContent(card: HTMLElement, exp: Experience, virtualIndex: number): void {
    const img = card.querySelector('img') as HTMLImageElement;
    const label = card.querySelector('.xp-card__label') as HTMLElement;
    
    img.src = exp.image;
    img.alt = exp.alt;
    label.textContent = exp.title;
    
    card.dataset.tags = JSON.stringify(exp.tags);
    card.dataset.url = exp.url;
    card.dataset.virtualIndex = String(virtualIndex);

    this.attachCardHandlers(card);
  }

  private getExperienceIndex(virtualIndex: number): number {
    if (this.filteredExperiences.length === 0) return 0;
    const length = this.filteredExperiences.length;
    return ((virtualIndex % length) + length) % length;
  }

  private calculateVisibleRange(): { startIndex: number; endIndex: number } {
    const viewportWidth = this.scroller.getBoundingClientRect().width;
    const startIndex = Math.floor(this.scrollPosition / ITEM_WIDTH) - VISIBLE_BUFFER;
    const endIndex = Math.ceil((this.scrollPosition + viewportWidth) / ITEM_WIDTH) + VISIBLE_BUFFER;
    return { startIndex, endIndex };
  }

  private removeInvisibleCards(neededIndices: Set<number>): void {
    this.activeCards.forEach((card, idx) => {
      if (!neededIndices.has(idx)) {
        this.recycleCard(card);
        this.activeCards.delete(idx);
      }
    });
  }

  private updateCardPositions(): void {
    // Use absolute left positioning to stay compatible with Easter Egg effects
    this.activeCards.forEach((card, idx) => {
      const left = idx * ITEM_WIDTH - this.scrollPosition;
      card.style.left = `${left}px`;
      const isHover = card.dataset.hover === '1';
      card.style.transform = isHover ? 'scale(1.06)' : '';
    });
  }

  private addNewVisibleCards(neededIndices: Set<number>): void {
    neededIndices.forEach(virtualIndex => {
      if (this.activeCards.has(virtualIndex) || this.filteredExperiences.length === 0) return;
      
      const expIndex = this.getExperienceIndex(virtualIndex);
      const exp = this.filteredExperiences[expIndex];
      
      const card = this.getOrCreateCard();
      this.updateCardContent(card, exp, virtualIndex);
      const left = virtualIndex * ITEM_WIDTH - this.scrollPosition;
      card.style.left = `${left}px`;
      card.style.transform = '';
      
      this.activeCards.set(virtualIndex, card);
      this.track.appendChild(card);
    });
  }

  private updateVisibleCards(): void {
    if (this.filteredExperiences.length === 0) {
      this.activeCards.forEach(card => this.recycleCard(card));
      this.activeCards.clear();
      return;
    }

    const { startIndex, endIndex } = this.calculateVisibleRange();
    
    const neededIndices = new Set<number>();
    for (let i = startIndex; i <= endIndex; i++) {
      neededIndices.add(i);
    }
    
    this.removeInvisibleCards(neededIndices);
    this.updateCardPositions();
    this.addNewVisibleCards(neededIndices);
  }

  private tick = (timestamp: number): void => {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    
    let deltaTime = (timestamp - this.lastTimestamp) / 1000;
    deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);
    this.lastTimestamp = timestamp;
    
    if (!this.isAutoScrollPaused && deltaTime > 0 && this.filteredExperiences.length > 0) {
      this.scrollPosition += SCROLL_SPEED_PX_PER_SEC * deltaTime;
      this.updateVisibleCards();
    }
    
    if (document.contains(this.scroller)) {
      requestAnimationFrame(this.tick);
    }
  };

  private startAnimationLoop(): void {
    // Respect reduced motion: slow or disable auto scroll if needed
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this.isAutoScrollPaused = true;
    }
    requestAnimationFrame(this.tick);
  }

  private applyFilter(tag: string): void {
    if (tag === 'all') {
      this.filteredExperiences = [...this.experiences];
    } else {
      this.filteredExperiences = this.experiences.filter(exp => 
        exp.tags.some(t => t.toLowerCase() === tag.toLowerCase())
      );
    }
    
    this.activeCards.forEach(card => this.recycleCard(card));
    this.activeCards.clear();
    this.scrollPosition = 0;
    this.updateVisibleCards();
  }

  private setupTagFiltering(): void {
    const tagBtns = document.querySelectorAll<HTMLElement>('.chip');
    
    tagBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tagBtns.forEach((b) => b.classList.remove('chip--active'));
        btn.classList.add('chip--active');
        const selectedTag = btn.dataset.tag || 'all';
        this.applyFilter(selectedTag);
      });
    });
  }
}
