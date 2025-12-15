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
const MAX_INERTIA_VELOCITY_PX_PER_MS = 1.2; // 1200px/s
const DRAG_THRESHOLD_PX = 6;
const CLICK_SUPPRESS_MS = 280;
const MIN_INERTIA_VELOCITY_PX_PER_MS = 0.02;
const INERTIA_FRICTION_PER_MS = 0.0025; // higher => stops sooner
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
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartScrollPosition = 0;
        this.lastMoveX = 0;
        this.lastMoveAt = 0;
        this.velocityPxPerMs = 0;
        this.inertiaRafId = null;
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
            this.beginUserDrag(e.clientX, e.timeStamp);
            // Listen on window so dragging continues even if pointer leaves the scroller.
            // Do NOT use pointer capture here: it breaks card click targeting.
            window.addEventListener('pointermove', this.handleScrollerPointerMove, { passive: false });
            window.addEventListener('pointerup', this.handleScrollerPointerUp);
            window.addEventListener('pointercancel', this.handleScrollerPointerUp);
        };
        this.handleScrollerPointerMove = (e) => {
            this.moveUserDrag(e.clientX, e.timeStamp, () => {
                if (e.cancelable)
                    e.preventDefault();
            });
        };
        this.handleScrollerPointerUp = (_e) => {
            this.endUserDrag();
            window.removeEventListener('pointermove', this.handleScrollerPointerMove);
            window.removeEventListener('pointerup', this.handleScrollerPointerUp);
            window.removeEventListener('pointercancel', this.handleScrollerPointerUp);
        };
        this.handleLegacyMouseDown = (e) => {
            if (e.button !== 0)
                return;
            this.beginUserDrag(e.clientX, e.timeStamp);
            window.addEventListener('mousemove', this.handleLegacyMouseMove);
            window.addEventListener('mouseup', this.handleLegacyMouseUp);
        };
        this.handleLegacyMouseMove = (e) => {
            this.moveUserDrag(e.clientX, e.timeStamp, () => {
                if (e.cancelable)
                    e.preventDefault();
            });
        };
        this.handleLegacyMouseUp = (_e) => {
            this.endUserDrag();
            window.removeEventListener('mousemove', this.handleLegacyMouseMove);
            window.removeEventListener('mouseup', this.handleLegacyMouseUp);
        };
        this.handleLegacyTouchStart = (e) => {
            const touch = e.touches[0];
            if (!touch)
                return;
            this.beginUserDrag(touch.clientX, e.timeStamp);
            window.addEventListener('touchmove', this.handleLegacyTouchMove, { passive: false });
            window.addEventListener('touchend', this.handleLegacyTouchEnd);
            window.addEventListener('touchcancel', this.handleLegacyTouchEnd);
        };
        this.handleLegacyTouchMove = (e) => {
            const touch = e.touches[0];
            if (!touch)
                return;
            this.moveUserDrag(touch.clientX, e.timeStamp, () => {
                if (e.cancelable)
                    e.preventDefault();
            });
        };
        this.handleLegacyTouchEnd = (e) => {
            const touch = e.changedTouches[0];
            if (!touch)
                return;
            this.endUserDrag();
            window.removeEventListener('touchmove', this.handleLegacyTouchMove);
            window.removeEventListener('touchend', this.handleLegacyTouchEnd);
            window.removeEventListener('touchcancel', this.handleLegacyTouchEnd);
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
    stopInertia() {
        if (this.inertiaRafId !== null) {
            cancelAnimationFrame(this.inertiaRafId);
            this.inertiaRafId = null;
        }
    }
    startInertia(initialVelocityPxPerMs) {
        this.stopInertia();
        this.pauseAutoScroll();
        let velocity = Math.max(-MAX_INERTIA_VELOCITY_PX_PER_MS, Math.min(MAX_INERTIA_VELOCITY_PX_PER_MS, initialVelocityPxPerMs));
        let lastAt = performance.now();
        // Apply one immediate step so inertia starts without a visible pause.
        // This avoids waiting for the next animation frame to see movement.
        {
            const dt = 16;
            velocity *= Math.exp(-INERTIA_FRICTION_PER_MS * dt);
            this.scrollPosition += velocity * dt;
            this.updateVisibleCards();
        }
        const tick = (now) => {
            const dt = Math.min(32, Math.max(0, now - lastAt));
            lastAt = now;
            // Exponential decay (ease-out feel).
            velocity *= Math.exp(-INERTIA_FRICTION_PER_MS * dt);
            this.scrollPosition += velocity * dt;
            this.updateVisibleCards();
            if (Math.abs(velocity) < MIN_INERTIA_VELOCITY_PX_PER_MS) {
                this.inertiaRafId = null;
                this.resumeAutoScroll();
                return;
            }
            this.inertiaRafId = requestAnimationFrame(tick);
        };
        this.inertiaRafId = requestAnimationFrame(tick);
    }
    beginUserDrag(clientX, timeStamp) {
        this.stopInertia();
        this.pauseAutoScroll();
        this.isPointerDown = true;
        this.isDragging = false;
        this.dragStartX = clientX;
        this.dragStartScrollPosition = this.scrollPosition;
        this.lastMoveX = clientX;
        this.lastMoveAt = timeStamp;
        this.velocityPxPerMs = 0;
        this.scroller.style.cursor = 'grabbing';
        // Allow vertical page scroll until we confirm horizontal dragging.
        this.scroller.style.touchAction = 'pan-y';
    }
    moveUserDrag(clientX, timeStamp, preventDefault) {
        if (!this.isPointerDown)
            return;
        const totalDx = clientX - this.dragStartX;
        if (!this.isDragging && Math.abs(totalDx) >= DRAG_THRESHOLD_PX) {
            this.isDragging = true;
            // iOS Safari: prevent the browser from taking over the gesture.
            this.scroller.style.touchAction = 'none';
        }
        const dx = clientX - this.lastMoveX;
        const dt = Math.max(1, timeStamp - this.lastMoveAt);
        const instantVelocity = (-dx) / dt; // pointer right => scrollPosition decreases
        // Low-pass filter for stable inertial start.
        this.velocityPxPerMs = this.velocityPxPerMs * 0.75 + instantVelocity * 0.25;
        this.velocityPxPerMs = Math.max(-MAX_INERTIA_VELOCITY_PX_PER_MS, Math.min(MAX_INERTIA_VELOCITY_PX_PER_MS, this.velocityPxPerMs));
        this.lastMoveX = clientX;
        this.lastMoveAt = timeStamp;
        if (this.isDragging) {
            preventDefault();
        }
        this.scrollPosition = this.dragStartScrollPosition - totalDx;
        this.updateVisibleCards();
    }
    endUserDrag() {
        if (!this.isPointerDown)
            return;
        this.isPointerDown = false;
        this.scroller.style.cursor = 'grab';
        this.scroller.style.touchAction = 'pan-y';
        if (!this.isDragging) {
            this.resumeAutoScroll();
            return;
        }
        this.suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
        this.isDragging = false;
        if (Math.abs(this.velocityPxPerMs) >= MIN_INERTIA_VELOCITY_PX_PER_MS) {
            this.startInertia(this.velocityPxPerMs);
            return;
        }
        this.resumeAutoScroll();
    }
    setupUserScrolling() {
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
