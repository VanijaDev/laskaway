/* Carousel Module - Virtual scrolling infinite carousel */

import type { Experience } from '../types';
import { openInNewTab } from '../utils.js';

// Constants
const CARD_WIDTH = 340;
const GAP = 32;
const ITEM_WIDTH = CARD_WIDTH + GAP;
const SCROLL_SPEED_PX_PER_SEC = 80;
const VISIBLE_BUFFER = 2;
const MAX_DELTA_TIME = 0.1;
const TRACK_HEIGHT = '220px';
const DEFAULT_URL = 'https://www.google.com';

// Module state
let filteredExperiences: Experience[] = [];

// Initialize carousel with virtual scrolling
export function initializeCarousel(experiences: Experience[]): void {
  filteredExperiences = [...experiences];
  
  const track = document.querySelector('.scroller__track') as HTMLElement | null;
  const scroller = document.querySelector('.scroller') as HTMLElement | null;
  
  if (!track || !scroller || filteredExperiences.length === 0) return;

  const carousel = new VirtualCarousel(track, scroller, experiences);
  carousel.initialize();
}

class VirtualCarousel {
  private readonly track: HTMLElement;
  private readonly scroller: HTMLElement;
  private readonly experiences: Experience[];
  private readonly isDesktopHover: boolean;
  
  private scrollPosition = 0;
  private lastTimestamp = 0;
  private isAutoScrollPaused = false;
  
  private readonly cardPool: HTMLElement[] = [];
  private readonly activeCards = new Map<number, HTMLElement>();

  constructor(track: HTMLElement, scroller: HTMLElement, experiences: Experience[]) {
    this.track = track;
    this.scroller = scroller;
    this.experiences = experiences;
    this.isDesktopHover = window.matchMedia('(hover: hover)').matches;
  }

  initialize(): void {
    this.setupTrack();
    this.updateVisibleCards();
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

  private createCardElement(): HTMLElement {
    const card = document.createElement('article');
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

    card.addEventListener('click', () => {
      openInNewTab(card.dataset.url || DEFAULT_URL);
    });
    card.dataset.hasClickHandler = 'true';

    if (this.isDesktopHover && !card.dataset.hoverBound) {
      card.addEventListener('mouseenter', () => {
        this.pauseAutoScroll();
        card.dataset.hover = '1';
        // Apply immediate visual feedback without waiting for next tick
        const idx = Number(card.dataset.virtualIndex || '0');
        const left = idx * ITEM_WIDTH - this.scrollPosition;
        card.style.transform = `translate3d(${left}px,0,0) scale(1.1)`;
      });
      card.addEventListener('mouseleave', () => {
        card.dataset.hover = '';
        this.resumeAutoScroll();
        const idx = Number(card.dataset.virtualIndex || '0');
        const left = idx * ITEM_WIDTH - this.scrollPosition;
        card.style.transform = `translate3d(${left}px,0,0)`;
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
    return ((virtualIndex % filteredExperiences.length) + filteredExperiences.length) % filteredExperiences.length;
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
    // Avoid multiple layout reads; compute via index math only
    this.activeCards.forEach((card, idx) => {
      const left = idx * ITEM_WIDTH - this.scrollPosition;
      // Use transform for better compositing when possible
      const isHover = card.dataset.hover === '1';
      card.style.transform = isHover
        ? `translate3d(${left}px,0,0) scale(1.06)`
        : `translate3d(${left}px,0,0)`;
    });
  }

  private addNewVisibleCards(neededIndices: Set<number>): void {
    neededIndices.forEach(virtualIndex => {
      if (this.activeCards.has(virtualIndex)) return;
      
      const expIndex = this.getExperienceIndex(virtualIndex);
      const exp = filteredExperiences[expIndex];
      
      const card = this.getOrCreateCard();
      this.updateCardContent(card, exp, virtualIndex);
      const left = virtualIndex * ITEM_WIDTH - this.scrollPosition;
      card.style.transform = `translate3d(${left}px,0,0)`;
      
      this.activeCards.set(virtualIndex, card);
      this.track.appendChild(card);
    });
  }

  private updateVisibleCards(): void {
    if (filteredExperiences.length === 0) {
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
    
    if (!this.isAutoScrollPaused && deltaTime > 0 && filteredExperiences.length > 0) {
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
      filteredExperiences = [...this.experiences];
    } else {
      filteredExperiences = this.experiences.filter(exp => 
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
