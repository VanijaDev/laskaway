/**
 * Card Stack Component
 *
 * A Tinder-like swipeable card stack with smooth animations and gesture support.
 * Built with modern web APIs and best practices for performance and maintainability.
 *
 * Features:
 * - Touch and mouse support via Pointer Events API
 * - Smooth animations with CSS transforms and RAF
 * - Virtual rendering (only renders visible cards)
 * - Clean state management with enum-based state machine
 * - Velocity-based swipe detection
 * - Hover effects on desktop
 */
// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================
const CONFIG = {
    VISIBLE_CARDS: 3, // Number of cards visible in stack
    SWIPE_THRESHOLD: 100, // Pixels to trigger swipe
    VELOCITY_THRESHOLD: 0.5, // px/ms velocity to trigger swipe
    FLY_OUT_DURATION: 400, // ms for card to fly out
    STACK_OFFSET_Y: 8, // Vertical offset per card in stack
    STACK_OFFSET_X: 0, // Horizontal offset per card in stack
    STACK_ROTATION: 2, // Rotation offset per card (degrees)
    STACK_SCALE: 0.95, // Scale reduction per card
};
// Card states for state machine
var CardState;
(function (CardState) {
    CardState["IDLE"] = "idle";
    CardState["DRAGGING"] = "dragging";
    CardState["ANIMATING"] = "animating";
    CardState["FLYING_OUT"] = "flying-out";
})(CardState || (CardState = {}));
// Direction for swipe actions
var SwipeDirection;
(function (SwipeDirection) {
    SwipeDirection["LEFT"] = "left";
    SwipeDirection["RIGHT"] = "right";
})(SwipeDirection || (SwipeDirection = {}));
// ============================================================================
// CARD STACK CLASS
// ============================================================================
export class CardStack {
    constructor(container, experiences) {
        this.currentIndex = 0;
        this.cards = [];
        this.dragState = null;
        this.rafId = null;
        this.handlePointerDown = (e) => {
            const card = e.currentTarget;
            if (card.dataset.state !== CardState.IDLE)
                return;
            e.preventDefault();
            card.setPointerCapture(e.pointerId);
            // Initialize drag state
            this.dragState = {
                startX: e.clientX,
                startY: e.clientY,
                currentX: e.clientX,
                currentY: e.clientY,
                deltaX: 0,
                deltaY: 0,
                startTime: performance.now(),
                velocity: 0,
            };
            card.dataset.state = CardState.DRAGGING;
            card.classList.add('is-dragging');
            card.addEventListener('pointermove', this.handlePointerMove);
            card.addEventListener('pointerup', this.handlePointerUp);
            card.addEventListener('pointercancel', this.handlePointerUp);
        };
        this.handlePointerMove = (e) => {
            if (!this.dragState)
                return;
            const card = e.currentTarget;
            this.dragState.currentX = e.clientX;
            this.dragState.currentY = e.clientY;
            this.dragState.deltaX = this.dragState.currentX - this.dragState.startX;
            this.dragState.deltaY = this.dragState.currentY - this.dragState.startY;
            // Calculate velocity
            const timeDelta = performance.now() - this.dragState.startTime;
            this.dragState.velocity = Math.abs(this.dragState.deltaX) / timeDelta;
            // Update card position
            this.updateCardTransform(card);
            this.updateSwipeIndicators(card);
        };
        this.handlePointerUp = (e) => {
            if (!this.dragState)
                return;
            const card = e.currentTarget;
            card.releasePointerCapture(e.pointerId);
            card.removeEventListener('pointermove', this.handlePointerMove);
            card.removeEventListener('pointerup', this.handlePointerUp);
            card.removeEventListener('pointercancel', this.handlePointerUp);
            // Determine if swipe was committed
            const shouldSwipe = Math.abs(this.dragState.deltaX) > CONFIG.SWIPE_THRESHOLD ||
                this.dragState.velocity > CONFIG.VELOCITY_THRESHOLD;
            if (shouldSwipe) {
                const direction = this.dragState.deltaX > 0 ? SwipeDirection.RIGHT : SwipeDirection.LEFT;
                this.commitSwipe(card, direction);
            }
            else {
                this.cancelSwipe(card);
            }
            this.dragState = null;
        };
        this.container = container;
        this.experiences = experiences;
    }
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    initialize() {
        this.renderCards();
        this.attachEventListeners();
    }
    destroy() {
        this.detachEventListeners();
        if (this.rafId)
            cancelAnimationFrame(this.rafId);
    }
    // ========================================================================
    // CARD RENDERING
    // ========================================================================
    renderCards() {
        // Clear existing cards
        this.container.innerHTML = '';
        this.cards = [];
        // Render only visible cards
        const endIndex = Math.min(this.currentIndex + CONFIG.VISIBLE_CARDS, this.experiences.length);
        for (let i = this.currentIndex; i < endIndex; i++) {
            const card = this.createCard(this.experiences[i], i);
            this.cards.push(card);
            this.container.appendChild(card);
        }
        // Apply stack positioning
        this.updateStackPositions();
    }
    createCard(experience, index) {
        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.index = String(index);
        card.dataset.state = CardState.IDLE;
        card.innerHTML = `
      <img src="${experience.image}" alt="${experience.alt}" />
      <figcaption>${experience.title}</figcaption>
      <div class="swipe-indicator swipe-indicator--like">LIKE</div>
      <div class="swipe-indicator swipe-indicator--nope">NOPE</div>
    `;
        return card;
    }
    updateStackPositions() {
        this.cards.forEach((card, index) => {
            const offset = index;
            const y = offset * CONFIG.STACK_OFFSET_Y;
            const x = offset * CONFIG.STACK_OFFSET_X;
            const rotation = offset * CONFIG.STACK_ROTATION;
            const scale = Math.pow(CONFIG.STACK_SCALE, offset);
            card.style.setProperty('--stack-y', `${y}px`);
            card.style.setProperty('--stack-x', `${x}px`);
            card.style.setProperty('--stack-rotation', `${rotation}deg`);
            card.style.setProperty('--stack-scale', String(scale));
            card.style.zIndex = String(this.cards.length - index);
        });
    }
    // ========================================================================
    // EVENT HANDLING
    // ========================================================================
    attachEventListeners() {
        const topCard = this.cards[0];
        if (!topCard)
            return;
        topCard.addEventListener('pointerdown', this.handlePointerDown);
    }
    detachEventListeners() {
        const topCard = this.cards[0];
        if (!topCard)
            return;
        topCard.removeEventListener('pointerdown', this.handlePointerDown);
    }
    // ========================================================================
    // ANIMATION & TRANSFORM
    // ========================================================================
    updateCardTransform(card) {
        if (!this.dragState)
            return;
        const { deltaX, deltaY } = this.dragState;
        const rotation = (deltaX / 20);
        card.style.transform = `
      translate(${deltaX}px, ${deltaY}px)
      rotate(${rotation}deg)
    `;
    }
    updateSwipeIndicators(card) {
        if (!this.dragState)
            return;
        const likeIndicator = card.querySelector('.swipe-indicator--like');
        const nopeIndicator = card.querySelector('.swipe-indicator--nope');
        const progress = Math.min(Math.abs(this.dragState.deltaX) / CONFIG.SWIPE_THRESHOLD, 1);
        const opacity = progress * 0.8;
        if (this.dragState.deltaX > 0) {
            likeIndicator.style.opacity = String(opacity);
            nopeIndicator.style.opacity = '0';
        }
        else {
            nopeIndicator.style.opacity = String(opacity);
            likeIndicator.style.opacity = '0';
        }
    }
    commitSwipe(card, direction) {
        card.dataset.state = CardState.FLYING_OUT;
        card.classList.remove('is-dragging');
        card.classList.add('is-flying-out');
        const targetX = direction === SwipeDirection.RIGHT ? 1000 : -1000;
        const targetY = -100;
        const rotation = direction === SwipeDirection.RIGHT ? 30 : -30;
        card.style.transition = `transform ${CONFIG.FLY_OUT_DURATION}ms cubic-bezier(0.4, 0.1, 0.2, 1), opacity ${CONFIG.FLY_OUT_DURATION}ms ease`;
        card.style.transform = `translate(${targetX}px, ${targetY}px) rotate(${rotation}deg)`;
        card.style.opacity = '0';
        setTimeout(() => {
            this.removeCard(card);
            this.nextCard();
        }, CONFIG.FLY_OUT_DURATION);
    }
    cancelSwipe(card) {
        card.dataset.state = CardState.ANIMATING;
        card.classList.remove('is-dragging');
        card.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        card.style.transform = '';
        // Reset indicators
        const indicators = card.querySelectorAll('.swipe-indicator');
        indicators.forEach(indicator => indicator.style.opacity = '0');
        setTimeout(() => {
            card.dataset.state = CardState.IDLE;
            card.style.transition = '';
        }, 300);
    }
    removeCard(card) {
        card.remove();
        this.cards.shift();
    }
    nextCard() {
        this.currentIndex++;
        // Render next card if available
        if (this.currentIndex + CONFIG.VISIBLE_CARDS <= this.experiences.length) {
            const nextIndex = this.currentIndex + CONFIG.VISIBLE_CARDS - 1;
            const nextCard = this.createCard(this.experiences[nextIndex], nextIndex);
            this.cards.push(nextCard);
            this.container.appendChild(nextCard);
        }
        this.updateStackPositions();
        // Attach listeners to new top card
        if (this.cards.length > 0) {
            this.attachEventListeners();
        }
        else {
            this.showCompletionState();
        }
    }
    showCompletionState() {
        this.container.innerHTML = `
      <div class="card-stack__complete">
        <div class="card-stack__complete-icon">🎁</div>
        <h3 class="card-stack__complete-title">All Done!</h3>
        <p class="card-stack__complete-text">You've seen all the experiences</p>
      </div>
    `;
    }
}
// ============================================================================
// INITIALIZATION
// ============================================================================
export function initializeCardStack(experiences) {
    const container = document.querySelector('.card-stack');
    if (!container || experiences.length === 0)
        return;
    const cardStack = new CardStack(container, experiences);
    cardStack.initialize();
}
