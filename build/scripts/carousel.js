/* Carousel Module - Virtual scrolling infinite carousel */
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
let filteredExperiences = [];
// Initialize carousel with virtual scrolling
export function initializeCarousel(experiences) {
    filteredExperiences = [...experiences];
    const track = document.querySelector('.scroller__track');
    const scroller = document.querySelector('.scroller');
    if (!track || !scroller || filteredExperiences.length === 0)
        return;
    const carousel = new VirtualCarousel(track, scroller, experiences);
    carousel.initialize();
}
class VirtualCarousel {
    constructor(track, scroller, experiences) {
        this.scrollPosition = 0;
        this.lastTimestamp = 0;
        this.isAutoScrollPaused = false;
        this.cardPool = [];
        this.activeCards = new Map();
        this.pauseAutoScroll = () => {
            this.isAutoScrollPaused = true;
        };
        this.resumeAutoScroll = () => {
            this.isAutoScrollPaused = false;
        };
        this.tick = (timestamp) => {
            if (!this.lastTimestamp)
                this.lastTimestamp = timestamp;
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
        this.track = track;
        this.scroller = scroller;
        this.experiences = experiences;
        this.isDesktopHover = window.matchMedia('(hover: hover)').matches;
    }
    initialize() {
        this.setupTrack();
        this.updateVisibleCards();
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
    createCardElement() {
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
        return ((virtualIndex % filteredExperiences.length) + filteredExperiences.length) % filteredExperiences.length;
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
    addNewVisibleCards(neededIndices) {
        neededIndices.forEach(virtualIndex => {
            if (this.activeCards.has(virtualIndex))
                return;
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
    updateVisibleCards() {
        if (filteredExperiences.length === 0) {
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
            filteredExperiences = [...this.experiences];
        }
        else {
            filteredExperiences = this.experiences.filter(exp => exp.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
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
