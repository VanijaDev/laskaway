/* Card Stack Module - Tinder-like swipeable card stack (Refactored) */
import { openInNewTab, triggerHaptic } from '../../utils.js';
// ============================================================================
// CONSTANTS
// ============================================================================
const MAX_SELECTIONS = 5;
const MAX_VISIBLE_CARDS = 3;
// Touch/Drag Configuration
const SWIPE_THRESHOLD = 50; // Minimum distance to trigger swipe (mobile optimized)
const VELOCITY_THRESHOLD = 0.3; // Minimum velocity (px/ms) to trigger fast swipe
const CLICK_TOLERANCE = 10; // Max movement to still register as click
const MIN_DRAG_DISTANCE = 15; // Minimum drag to prevent accidental swipes
// Animation Durations (ms)
const FLY_OUT_DURATION = 500; // Fly-out for snappier releases
const WIGGLE_ANIMATION_DURATION = 2000;
const WIGGLE_INITIAL_DELAY = 1000;
const WIGGLE_GAP_BETWEEN = 4000;
const DEMO_ANIMATION_DURATION = 3000;
// Visual Constants
const ROTATION_FACTOR = 0.08;
const LABEL_INTENSITY_DIVISOR = 120;
const AUTO_DEMO_THRESHOLD = 180;
const FIFTH_CARD_FADE_MULTIPLIER = 0.5;
const HAPTIC_THRESHOLD = 180;
const CLICK_BLOCK_DURATION = 800;
const DEFAULT_URL = 'https://www.google.com';
const isMobileQuery = window.matchMedia('(max-width: 960px)');
var CardState;
(function (CardState) {
    CardState["IDLE"] = "idle";
    CardState["DRAGGING"] = "dragging";
    CardState["FLYING_OUT"] = "flying-out";
    CardState["SNAPPING_BACK"] = "snapping-back";
    CardState["REMOVED"] = "removed";
})(CardState || (CardState = {}));
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const getElementCenter = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};
const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
};
// ============================================================================
// MAIN CLASS
// ============================================================================
export function initializeCardStack(experiences) {
    const stackElement = document.querySelector('.card-stack');
    if (!stackElement)
        return;
    const cardStack = new CardStack(stackElement, experiences);
    cardStack.initialize();
}
class CardStack {
    constructor(stack, experiences) {
        this.nextExpIndex = 0;
        this.likedExperiences = [];
        // State
        this.activeCards = [];
        this.cardStates = new WeakMap();
        this.hasInteracted = false;
        this.hintDismissed = false;
        this.clickBlockUntil = 0;
        // Animation State
        this.isDemoRunning = false;
        this.demoRAF = null;
        // Body scroll lock state
        this.prevBodyOverflow = '';
        this.prevBodyTouchAction = '';
        this.stack = stack;
        this.experiences = experiences;
        this.giftBox = document.getElementById('giftBox');
        this.selectedCardsContainer = document.getElementById('selectedCards');
        this.dragHint = document.getElementById('dragHint');
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        this.setupInitialState();
        this.initVirtualCards();
        if (!this.prefersReducedMotion) {
            this.scheduleWiggleAnimations();
            this.setupVisibilityHandling();
        }
    }
    setupInitialState() {
        this.stack.classList.remove('is-hidden');
        if (this.giftBox) {
            this.giftBox.classList.remove('is-visible');
            this.giftBox.classList.add('hidden');
        }
    }
    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAllWiggles();
                this.cancelDemoIfAny();
            }
        }, { passive: true });
    }
    initVirtualCards() {
        const cardCount = Math.min(MAX_VISIBLE_CARDS, this.experiences.length);
        for (let i = 0; i < cardCount; i++) {
            const exp = this.experiences[this.nextExpIndex++];
            const card = this.createCard(exp);
            this.stack.appendChild(card);
            this.activeCards.push(card);
            this.cardStates.set(card, CardState.IDLE);
            this.attachDragHandlers(card);
        }
    }
    // ============================================================================
    // CARD CREATION & MANAGEMENT
    // ============================================================================
    createCard(exp) {
        const card = document.createElement('figure');
        card.className = 'card card--hint-wiggle';
        card.innerHTML = `
      <img src="${exp.image}" alt="${exp.alt}" loading="lazy" />
      <div class="swipe-label swipe-label--like" aria-hidden="true">Gift this!</div>
      <div class="swipe-label swipe-label--nope" aria-hidden="true">Not today</div>
      <figcaption>${exp.title}</figcaption>
    `;
        const img = card.querySelector('img');
        if (img)
            img.draggable = false;
        card.dataset.title = exp.title;
        card.dataset.url = exp.url;
        this.setRandomBase(card);
        return card;
    }
    setRandomBase(el) {
        const randX = Math.floor(Math.random() * 9 - 4);
        const randY = Math.floor(Math.random() * 9 - 4);
        const randTilt = Math.floor(Math.random() * 13 - 6);
        el.style.setProperty('--base-x', `${randX}px`);
        el.style.setProperty('--base-y', `${randY}px`);
        el.style.setProperty('--base-r', `${randTilt}deg`);
    }
    getTopCard() {
        return this.activeCards[this.activeCards.length - 1] || null;
    }
    getCardLabels(card) {
        return {
            like: card.querySelector('.swipe-label--like'),
            nope: card.querySelector('.swipe-label--nope')
        };
    }
    // ============================================================================
    // DRAG HANDLING (Mobile-Optimized)
    // ============================================================================
    attachDragHandlers(card) {
        const dragState = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            startTime: 0,
            pointerId: null,
            moved: false,
            hapticTriggered: false
        };
        const labels = this.getCardLabels(card);
        // Pointer Down - Start drag
        const onPointerDown = (e) => {
            // Only allow top card to be dragged
            if (card !== this.getTopCard())
                return;
            if (this.cardStates.get(card) !== CardState.IDLE)
                return;
            e.preventDefault();
            // Lock body scroll
            this.lockBodyScroll();
            // Cancel any running demo
            this.cancelDemoIfAny();
            // Initialize drag state
            dragState.active = true;
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
            dragState.currentX = e.clientX;
            dragState.currentY = e.clientY;
            dragState.startTime = performance.now();
            dragState.pointerId = e.pointerId;
            dragState.moved = false;
            dragState.hapticTriggered = false;
            // Capture pointer for reliable tracking
            card.setPointerCapture(dragState.pointerId);
            // Update visual state
            card.classList.add('is-dragging');
            card.style.transition = 'none';
            card.style.zIndex = '10';
            this.cardStates.set(card, CardState.DRAGGING);
            // Mark as interacted
            if (!this.hasInteracted) {
                this.hasInteracted = true;
                this.stopAllWiggles();
            }
        };
        // Pointer Move - Update drag
        const onPointerMove = (e) => {
            if (!dragState.active)
                return;
            e.preventDefault();
            dragState.currentX = e.clientX;
            dragState.currentY = e.clientY;
            const dx = dragState.currentX - dragState.startX;
            const dy = dragState.currentY - dragState.startY;
            // Check if moved beyond tolerance
            if (!dragState.moved && (Math.abs(dx) > CLICK_TOLERANCE || Math.abs(dy) > CLICK_TOLERANCE)) {
                dragState.moved = true;
            }
            // Update card position
            this.updateCardTransform(card, dx, dy);
            // Update label opacity
            const intensity = clamp(Math.abs(dx) / LABEL_INTENSITY_DIVISOR, 0, 1);
            this.updateLabelOpacity(labels, dx, intensity);
            // Apply fifth card fade effect
            this.applyFifthCardFade(card, dx);
            // Trigger haptic feedback at threshold
            if (!dragState.hapticTriggered && Math.abs(dx) > HAPTIC_THRESHOLD) {
                dragState.hapticTriggered = true;
                triggerHaptic(20);
            }
        };
        // Pointer Up - End drag
        const onPointerUp = (e) => {
            if (!dragState.active)
                return;
            e.preventDefault();
            // Release pointer capture
            if (dragState.pointerId !== null) {
                card.releasePointerCapture(dragState.pointerId);
            }
            // Unlock body scroll
            this.unlockBodyScroll();
            // Reset dragging state
            dragState.active = false;
            card.classList.remove('is-dragging');
            const dx = dragState.currentX - dragState.startX;
            const dy = dragState.currentY - dragState.startY;
            const duration = performance.now() - dragState.startTime;
            // Check if it was a click (minimal movement)
            if (!dragState.moved || (Math.abs(dx) < CLICK_TOLERANCE && Math.abs(dy) < CLICK_TOLERANCE)) {
                this.handleClick(card);
                this.resetCardVisuals(card);
                this.cardStates.set(card, CardState.IDLE);
                return;
            }
            // Check if drag distance meets minimum
            if (Math.abs(dx) < MIN_DRAG_DISTANCE) {
                this.handleSnapBack(card);
                return;
            }
            // Calculate velocity
            const velocity = duration > 0 ? Math.abs(dx) / duration : 0;
            // Determine if swipe should commit
            const shouldCommit = Math.abs(dx) >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD;
            if (shouldCommit) {
                const dirRight = dx > 0;
                this.handleSwipeCommit(card, dirRight, labels);
            }
            else {
                this.handleSnapBack(card);
            }
        };
        // Pointer Cancel - Handle interruption
        const onPointerCancel = () => {
            if (!dragState.active)
                return;
            dragState.active = false;
            this.unlockBodyScroll();
            this.handleSnapBack(card);
        };
        // Click handler
        const onClick = (evt) => {
            // Block clicks during/after drag
            if (dragState.moved || Date.now() < this.clickBlockUntil) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        };
        // Attach event listeners
        card.addEventListener('pointerdown', onPointerDown);
        card.addEventListener('pointermove', onPointerMove);
        card.addEventListener('pointerup', onPointerUp);
        card.addEventListener('pointercancel', onPointerCancel);
        card.addEventListener('lostpointercapture', onPointerCancel);
        card.addEventListener('click', onClick);
    }
    // ============================================================================
    // VISUAL UPDATES
    // ============================================================================
    updateCardTransform(card, dx, dy) {
        const rot = dx * ROTATION_FACTOR;
        card.style.setProperty('--drag-x', `${dx}px`);
        card.style.setProperty('--drag-y', `${dy}px`);
        card.style.setProperty('--drag-r', `${rot}deg`);
    }
    clearCardTransform(card) {
        card.style.removeProperty('--drag-x');
        card.style.removeProperty('--drag-y');
        card.style.removeProperty('--drag-r');
    }
    updateLabelOpacity(labels, dx, intensity) {
        if (dx > 0) {
            if (labels.like)
                labels.like.style.opacity = String(intensity);
            if (labels.nope)
                labels.nope.style.opacity = '0';
        }
        else if (dx < 0) {
            if (labels.nope)
                labels.nope.style.opacity = String(intensity);
            if (labels.like)
                labels.like.style.opacity = '0';
        }
        else {
            if (labels.like)
                labels.like.style.opacity = '0';
            if (labels.nope)
                labels.nope.style.opacity = '0';
        }
    }
    resetCardVisuals(card) {
        this.clearCardTransform(card);
        card.style.transition = '';
        card.style.zIndex = '';
        const labels = this.getCardLabels(card);
        if (labels.like)
            labels.like.style.opacity = '0';
        if (labels.nope)
            labels.nope.style.opacity = '0';
    }
    applyFifthCardFade(draggedCard, dx) {
        if (this.likedExperiences.length !== 4)
            return;
        if (dx <= 0) {
            this.resetStackOpacity(draggedCard);
            return;
        }
        const cardWidth = draggedCard.getBoundingClientRect().width;
        const fullFadeAt = SWIPE_THRESHOLD + cardWidth * FIFTH_CARD_FADE_MULTIPLIER;
        const fadeProgress = clamp(dx / fullFadeAt, 0, 1);
        this.updateStackOpacity(draggedCard, fadeProgress);
    }
    updateStackOpacity(excludeCard, fadeProgress) {
        this.activeCards
            .filter(c => c !== excludeCard)
            .forEach(c => {
            c.style.opacity = String(1 - fadeProgress);
        });
    }
    resetStackOpacity(excludeCard) {
        this.activeCards
            .filter(c => c !== excludeCard)
            .forEach(c => {
            c.style.opacity = '';
        });
    }
    // ============================================================================
    // SWIPE ACTIONS
    // ============================================================================
    handleSwipeCommit(card, dirRight, labels) {
        this.cardStates.set(card, CardState.FLYING_OUT);
        // Apply transition with reflow to ensure it takes effect
        const flyOutDuration = FLY_OUT_DURATION / 1000; // Convert to seconds
        card.style.transition = `transform ${flyOutDuration}s ease-in, opacity ${flyOutDuration}s ease-in`;
        card.style.zIndex = '99';
        void card.offsetWidth; // Force reflow
        // Handle like/nope action
        if (dirRight) {
            this.handleLikeAction(card, labels);
        }
        else {
            this.handleNopeAction(labels);
        }
        // Dismiss hint
        if (!this.hintDismissed) {
            this.dragHint?.classList.add('drag-hint--fade');
            this.hintDismissed = true;
        }
        // Apply fly-out class
        card.classList.add(dirRight ? 'fly-out-right' : 'fly-out-left');
        // Handle completion
        let cleaned = false;
        const handleEnd = () => {
            if (cleaned)
                return;
            cleaned = true;
            card.removeEventListener('transitionend', handleEnd);
            this.cleanupSwipedCard(card, dirRight);
        };
        card.addEventListener('transitionend', handleEnd, { once: true });
        // Safety timeout
        setTimeout(() => handleEnd(), FLY_OUT_DURATION + 100);
    }
    handleSnapBack(card) {
        this.cardStates.set(card, CardState.SNAPPING_BACK);
        card.classList.add('snap-back');
        this.clearCardTransform(card);
        this.resetStackOpacity(card);
        const labels = this.getCardLabels(card);
        if (labels.like)
            labels.like.style.opacity = '0';
        if (labels.nope)
            labels.nope.style.opacity = '0';
        let cleaned = false;
        const handleBack = () => {
            if (cleaned)
                return;
            cleaned = true;
            card.classList.remove('snap-back');
            card.style.transition = '';
            card.style.zIndex = '';
            card.removeEventListener('transitionend', handleBack);
            // Haptic bounce feedback
            card.classList.add('haptic-bounce');
            setTimeout(() => card.classList.remove('haptic-bounce'), 200);
            this.cardStates.set(card, CardState.IDLE);
        };
        card.addEventListener('transitionend', handleBack, { once: true });
        // Safety timeout (snap-back duration is 220ms in CSS)
        setTimeout(() => handleBack(), 320);
    }
    handleClick(card) {
        // Block subsequent clicks
        this.clickBlockUntil = Date.now() + CLICK_BLOCK_DURATION;
        // Open URL
        const url = card.dataset.url || DEFAULT_URL;
        openInNewTab(url);
    }
    handleLikeAction(card, labels) {
        const title = card.dataset.title || '';
        const url = card.dataset.url || '';
        const imgEl = card.querySelector('img');
        const image = imgEl ? imgEl.src : '';
        this.likedExperiences.push({ title, image, url });
        if (!this.prefersReducedMotion) {
            this.showCountNumber(this.likedExperiences.length);
        }
        if (labels.like) {
            labels.like.style.opacity = '1';
            labels.like.classList.add('shake-right');
            setTimeout(() => labels.like?.classList.remove('shake-right'), 220);
        }
    }
    handleNopeAction(labels) {
        if (labels.nope) {
            labels.nope.style.opacity = '1';
            labels.nope.classList.add('shake-left');
            setTimeout(() => labels.nope?.classList.remove('shake-left'), 220);
        }
    }
    // ============================================================================
    // CARD LIFECYCLE
    // ============================================================================
    cleanupSwipedCard(card, dirRight) {
        this.cardStates.set(card, CardState.REMOVED);
        card.classList.remove('fly-out-right', 'fly-out-left');
        this.resetCardVisuals(card);
        // Check if max selections reached
        if (this.likedExperiences.length >= MAX_SELECTIONS) {
            this.showGiftBox();
            return;
        }
        // Remove from active cards
        const topIdx = this.activeCards.indexOf(card);
        if (topIdx > -1) {
            this.activeCards.splice(topIdx, 1);
        }
        // Recycle or remove card
        if (this.nextExpIndex < this.experiences.length) {
            this.recycleCard(card);
        }
        else {
            card.remove();
        }
        // Apply dribble effect for likes
        if (dirRight) {
            this.applyDribbleEffect();
        }
    }
    recycleCard(card) {
        const nextExp = this.experiences[this.nextExpIndex++];
        // Update card content
        const img = card.querySelector('img');
        const caption = card.querySelector('figcaption');
        img.src = nextExp.image;
        img.alt = nextExp.alt;
        caption.textContent = nextExp.title;
        card.dataset.title = nextExp.title;
        card.dataset.url = nextExp.url;
        // Reset visual state
        this.resetCardVisuals(card);
        this.setRandomBase(card);
        // Insert at bottom of stack
        this.stack.insertBefore(card, this.stack.firstChild);
        this.activeCards.unshift(card);
        this.cardStates.set(card, CardState.IDLE);
        // Animate other cards
        const others = this.activeCards.slice(0, -1);
        others.forEach(c => c.classList.add('base-animate'));
        this.setRandomBase(this.activeCards[0]);
        setTimeout(() => {
            others.forEach(c => c.classList.remove('base-animate'));
        }, 240);
    }
    applyDribbleEffect() {
        setTimeout(() => {
            const others = this.activeCards.slice(0, -1);
            others.forEach((c, idx) => {
                const randomDelay = Math.random() * 80;
                setTimeout(() => {
                    c.classList.add('dribble');
                    setTimeout(() => c.classList.remove('dribble'), 320);
                }, idx * 60 + randomDelay);
            });
        }, 200);
    }
    // ============================================================================
    // BODY SCROLL LOCK
    // ============================================================================
    lockBodyScroll() {
        this.prevBodyOverflow = document.body.style.overflow;
        this.prevBodyTouchAction = document.body.style.touchAction;
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
    }
    unlockBodyScroll() {
        document.body.style.overflow = this.prevBodyOverflow;
        document.body.style.touchAction = this.prevBodyTouchAction;
    }
    // ============================================================================
    // IDLE ANIMATIONS
    // ============================================================================
    scheduleWiggleAnimations() {
        setTimeout(() => {
            if (!this.hasInteracted)
                this.startIdleWiggleDemoLoop();
        }, WIGGLE_INITIAL_DELAY);
    }
    async startIdleWiggleDemoLoop() {
        while (!this.hasInteracted) {
            if (document.hidden) {
                await this.sleep(300);
                continue;
            }
            this.triggerWiggle();
            await this.sleep(WIGGLE_ANIMATION_DURATION);
            if (this.hasInteracted || document.hidden)
                continue;
            await this.sleep(WIGGLE_GAP_BETWEEN);
            if (this.hasInteracted || document.hidden)
                continue;
            await this.demoTopCardDragOnce();
            if (this.hasInteracted || document.hidden)
                continue;
            await this.sleep(WIGGLE_GAP_BETWEEN);
        }
    }
    triggerWiggle() {
        if (this.hasInteracted || document.hidden)
            return;
        this.activeCards.forEach((card, i) => {
            card.style.setProperty('--wiggle-delay', `${1 + i * 0.3}s`);
            if (!card.classList.contains('card--hint-wiggle')) {
                card.classList.add('card--hint-wiggle');
            }
            else {
                card.classList.remove('card--hint-wiggle');
                void card.offsetWidth;
                card.classList.add('card--hint-wiggle');
            }
        });
    }
    stopAllWiggles() {
        this.activeCards.forEach(card => {
            card.classList.remove('card--hint-wiggle');
            card.style.animation = 'none';
        });
    }
    cancelDemoIfAny() {
        if (!this.isDemoRunning)
            return;
        this.isDemoRunning = false;
        if (this.demoRAF)
            cancelAnimationFrame(this.demoRAF);
        this.demoRAF = null;
        const topCard = this.getTopCard();
        if (topCard) {
            this.clearCardTransform(topCard);
            const labels = this.getCardLabels(topCard);
            if (labels.like)
                labels.like.style.opacity = '0';
            if (labels.nope)
                labels.nope.style.opacity = '0';
        }
    }
    demoTopCardDragOnce() {
        return new Promise((resolve) => {
            if (this.hasInteracted || this.isDemoRunning || isMobileQuery.matches) {
                return resolve();
            }
            const card = this.getTopCard();
            if (!card)
                return resolve();
            this.isDemoRunning = true;
            card.classList.remove('card--hint-wiggle');
            void card.offsetWidth;
            const labels = this.getCardLabels(card);
            const autoThreshold = isMobileQuery.matches ? AUTO_DEMO_THRESHOLD / 2 : AUTO_DEMO_THRESHOLD;
            const start = performance.now();
            const step = (now) => {
                if (this.hasInteracted) {
                    this.isDemoRunning = false;
                    this.demoRAF = null;
                    return resolve();
                }
                const elapsed = now - start;
                const progress = Math.min(1, elapsed / DEMO_ANIMATION_DURATION);
                let dx = 0;
                let dy = 0;
                if (progress < 0.33) {
                    const phaseProgress = easeInOutCubic(progress / 0.33);
                    dx = -autoThreshold * phaseProgress;
                    dy = -Math.abs(Math.sin(phaseProgress * Math.PI)) * 15;
                }
                else if (progress < 0.66) {
                    const phaseProgress = easeInOutCubic((progress - 0.33) / 0.33);
                    dx = -autoThreshold + (2 * autoThreshold * phaseProgress);
                    dy = -Math.abs(Math.sin(phaseProgress * Math.PI)) * 15;
                }
                else {
                    const phaseProgress = easeInOutCubic((progress - 0.66) / 0.34);
                    dx = autoThreshold * (1 - phaseProgress);
                    dy = -Math.abs(Math.sin(phaseProgress * Math.PI)) * 10;
                }
                this.updateCardTransform(card, dx, dy);
                const intensity = clamp(Math.abs(dx) / LABEL_INTENSITY_DIVISOR, 0, 1);
                this.updateLabelOpacity(labels, dx, intensity);
                if (progress < 1) {
                    this.demoRAF = requestAnimationFrame(step);
                }
                else {
                    this.clearCardTransform(card);
                    if (labels.like)
                        labels.like.style.opacity = '0';
                    if (labels.nope)
                        labels.nope.style.opacity = '0';
                    this.isDemoRunning = false;
                    this.demoRAF = null;
                    resolve();
                }
            };
            this.demoRAF = requestAnimationFrame(step);
        });
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // ============================================================================
    // GIFT BOX
    // ============================================================================
    showGiftBox() {
        if (this.stack) {
            this.stack.classList.add('is-hidden');
            setTimeout(() => {
                this.activeCards.splice(0).forEach(node => node.remove());
            }, 400);
        }
        if (this.giftBox) {
            this.giftBox.classList.remove('hidden');
            this.giftBox.classList.add('is-visible');
        }
        this.dragHint?.classList.add('drag-hint--fade');
        this.stopAllWiggles();
        this.cancelDemoIfAny();
        if (!this.prefersReducedMotion && this.giftBox) {
            this.fireConfetti(this.giftBox);
        }
        this.populateMiniCards();
        if (this.giftBox) {
            this.giftBox.setAttribute('tabindex', '-1');
            this.giftBox.focus({ preventScroll: true });
        }
    }
    populateMiniCards() {
        if (!this.selectedCardsContainer)
            return;
        this.likedExperiences.forEach(exp => {
            const mini = document.createElement('div');
            mini.className = 'gift-box__card-mini';
            mini.innerHTML = `<img src="${exp.image}" alt="${exp.title}" />`;
            mini.title = exp.title;
            mini.style.cursor = 'pointer';
            mini.addEventListener('click', () => openInNewTab(exp.url));
            this.selectedCardsContainer.appendChild(mini);
        });
    }
    // ============================================================================
    // CONFETTI
    // ============================================================================
    getStackBandCenter() {
        const stackRect = this.stack.getBoundingClientRect();
        const stackCenterX = stackRect.left + stackRect.width / 2;
        const stackCenterY = stackRect.top + stackRect.height / 2;
        const bandWidth = stackRect.width * 0.35;
        const bandHeight = stackRect.height * 0.55;
        const bandX1 = stackCenterX + stackRect.width * 0.05;
        const bandX2 = stackCenterX + bandWidth;
        const bandY1 = stackCenterY - bandHeight / 2;
        const bandY2 = stackCenterY + bandHeight / 2;
        return {
            x: (bandX1 + bandX2) / 2,
            y: (bandY1 + bandY2) / 2
        };
    }
    showCountNumber(countNumber) {
        const { x: centerX, y: centerY } = this.getStackBandCenter();
        const num = document.createElement('div');
        num.className = 'confetti-number';
        num.textContent = String(countNumber);
        const dx = 140 + Math.random() * 100;
        const dy = -(60 + Math.random() * 80);
        const rot = Math.floor(Math.random() * 40 - 20);
        num.style.left = `${centerX}px`;
        num.style.top = `${centerY}px`;
        num.style.setProperty('--dx', `${dx}px`);
        num.style.setProperty('--dy', `${dy}px`);
        num.style.setProperty('--rot', `${rot}deg`);
        num.style.setProperty('--dur', '1400ms');
        num.style.setProperty('--delay', '0ms');
        document.body.appendChild(num);
        num.addEventListener('animationend', () => num.remove(), { once: true });
    }
    fireConfetti(targetElement) {
        if (typeof window === 'undefined' || typeof window.confetti !== 'function') {
            return;
        }
        const { x, y } = getElementCenter(targetElement);
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
        const originX = clamp(x / viewportWidth, 0, 1);
        const originY = clamp(y / viewportHeight, 0, 1);
        window.confetti({
            particleCount: 300,
            spread: 100,
            origin: { x: originX, y: originY },
            disableForReducedMotion: this.prefersReducedMotion,
        });
    }
}
