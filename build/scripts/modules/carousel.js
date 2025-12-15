/* Carousel Module - Virtual scrolling infinite carousel */
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
// Initialize carousel with virtual scrolling
export function initializeCarousel(experiences) {
    const track = document.querySelector('.scroller__track');
    const scroller = document.querySelector('.scroller');
    if (!track || !scroller || experiences.length === 0)
        return;
    const carousel = new VirtualCarousel(track, scroller, experiences);
    carousel.initialize();
}
class VirtualCarousel {
    constructor(track, scroller, experiences) {
        this.scrollPosition = 0;
        this.lastTimestamp = 0;
        this.isAutoScrollPaused = false;
        this.isPointerDown = false;
        this.isUserDragging = false;
        this.dragStartX = 0;
        this.dragStartScrollPosition = 0;
        this.suppressClickUntil = 0;
        this.cardPool = [];
        this.activeCards = new Map();
        this.pauseAutoScroll = () => {
            this.isAutoScrollPaused = true;
        };
        this.resumeAutoScroll = () => {
            this.isAutoScrollPaused = false;
        };
        this.handleScrollerPointerDown = (e) => {
            // Only left mouse / primary touch.
            if (e.pointerType === 'mouse' && e.button !== 0)
                return;
            this.isPointerDown = true;
            this.isUserDragging = false;
            this.dragStartX = e.clientX;
            this.dragStartScrollPosition = this.scrollPosition;
            this.pauseAutoScroll();
            this.scroller.style.cursor = 'grabbing';
            // Listen on window so dragging continues even if pointer leaves the scroller.
            // Do NOT use pointer capture here: it breaks card click targeting.
            window.addEventListener('pointermove', this.handleScrollerPointerMove);
            window.addEventListener('pointerup', this.handleScrollerPointerUp);
            window.addEventListener('pointercancel', this.handleScrollerPointerUp);
        };
        this.handleScrollerPointerMove = (e) => {
            if (!this.isPointerDown)
                return;
            const deltaX = e.clientX - this.dragStartX;
            if (!this.isUserDragging && Math.abs(deltaX) > 4) {
                this.isUserDragging = true;
            }
            if (this.isUserDragging) {
                // Prevent text selection / native drag behavior while dragging.
                e.preventDefault();
            }
            // Drag right => show earlier items (decrease scrollPosition), drag left => show later items.
            this.scrollPosition = this.dragStartScrollPosition - deltaX;
            this.updateVisibleCards();
        };
        this.handleScrollerPointerUp = (_e) => {
            if (!this.isPointerDown)
                return;
            this.isPointerDown = false;
            this.scroller.style.cursor = 'grab';
            window.removeEventListener('pointermove', this.handleScrollerPointerMove);
            window.removeEventListener('pointerup', this.handleScrollerPointerUp);
            window.removeEventListener('pointercancel', this.handleScrollerPointerUp);
            if (this.isUserDragging) {
                // Suppress the click that may follow a drag release.
                this.suppressClickUntil = performance.now() + 300;
                this.isUserDragging = false;
            }
            this.resumeAutoScroll();
        };
        this.tick = (timestamp) => {
            if (!this.lastTimestamp)
                this.lastTimestamp = timestamp;
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
        this.track = track;
        this.scroller = scroller;
        this.experiences = experiences;
        this.filteredExperiences = [...experiences];
        this.isDesktopHover = window.matchMedia('(hover: hover)').matches;
    }
    initialize() {
        this.setupTrack();
        this.updateVisibleCards();
        this.setupUserScrolling();
        this.startAnimationLoop();
        this.setupTagFiltering();
        document.addEventListener('visibilitychange', () => {
            this.isAutoScrollPaused = document.hidden;
        }, { passive: true });
    }
    setupTrack() {
        this.track.style.position = 'relative';
        this.track.style.height = TRACK_HEIGHT;
        this.track.style.overflow = 'visible';
        this.track.style.animation = 'none';
    }
    setupUserScrolling() {
        // Keep vertical scrolling on touch devices while enabling horizontal dragging here.
        this.scroller.style.touchAction = 'pan-y';
        this.scroller.style.cursor = 'grab';
        this.scroller.addEventListener('pointerdown', this.handleScrollerPointerDown);
    }
    createCardElement() {
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
    getOrCreateCard() {
        return this.cardPool.pop() || this.createCardElement();
    }
    recycleCard(card) {
        card.remove();
        this.cardPool.push(card);
    }
    attachCardHandlers(card) {
        if (card.dataset.hasClickHandler)
            return;
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
    updateCardContent(card, exp, virtualIndex) {
        const img = card.querySelector('img');
        const label = card.querySelector('.xp-card__label');
        img.src = exp.image;
        img.alt = exp.alt;
        label.textContent = exp.title;
        card.dataset.tags = JSON.stringify(exp.tags);
        card.dataset.url = exp.url;
        card.dataset.virtualIndex = String(virtualIndex);
        this.attachCardHandlers(card);
    }
    getExperienceIndex(virtualIndex) {
        if (this.filteredExperiences.length === 0)
            return 0;
        const length = this.filteredExperiences.length;
        return ((virtualIndex % length) + length) % length;
    }
    calculateVisibleRange() {
        const viewportWidth = this.scroller.getBoundingClientRect().width;
        const startIndex = Math.floor(this.scrollPosition / ITEM_WIDTH) - VISIBLE_BUFFER;
        const endIndex = Math.ceil((this.scrollPosition + viewportWidth) / ITEM_WIDTH) + VISIBLE_BUFFER;
        return { startIndex, endIndex };
    }
    removeInvisibleCards(neededIndices) {
        this.activeCards.forEach((card, idx) => {
            if (!neededIndices.has(idx)) {
                this.recycleCard(card);
                this.activeCards.delete(idx);
            }
        });
    }
    updateCardPositions() {
        // Use absolute left positioning to stay compatible with Easter Egg effects
        this.activeCards.forEach((card, idx) => {
            const left = idx * ITEM_WIDTH - this.scrollPosition;
            card.style.left = `${left}px`;
            const isHover = card.dataset.hover === '1';
            card.style.transform = isHover ? 'scale(1.06)' : '';
        });
    }
    addNewVisibleCards(neededIndices) {
        neededIndices.forEach(virtualIndex => {
            if (this.activeCards.has(virtualIndex) || this.filteredExperiences.length === 0)
                return;
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
    updateVisibleCards() {
        if (this.filteredExperiences.length === 0) {
            this.activeCards.forEach(card => this.recycleCard(card));
            this.activeCards.clear();
            return;
        }
        const { startIndex, endIndex } = this.calculateVisibleRange();
        const neededIndices = new Set();
        for (let i = startIndex; i <= endIndex; i++) {
            neededIndices.add(i);
        }
        this.removeInvisibleCards(neededIndices);
        this.updateCardPositions();
        this.addNewVisibleCards(neededIndices);
    }
    startAnimationLoop() {
        // Respect reduced motion: slow or disable auto scroll if needed
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            this.isAutoScrollPaused = true;
        }
        requestAnimationFrame(this.tick);
    }
    applyFilter(tag) {
        if (tag === 'all') {
            this.filteredExperiences = [...this.experiences];
        }
        else {
            this.filteredExperiences = this.experiences.filter(exp => exp.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
        }
        this.activeCards.forEach(card => this.recycleCard(card));
        this.activeCards.clear();
        this.scrollPosition = 0;
        this.updateVisibleCards();
    }
    setupTagFiltering() {
        const tagBtns = document.querySelectorAll('.chip');
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
