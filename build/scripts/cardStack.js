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
        this.parentElement = null;
        this.currentIndex = 0;
        this.cards = [];
        this.dragState = null;
        this.rafId = null;
        this.wiggleIntervalId = null;
        this.hasUserInteracted = false;
        this.likedCards = [];
        this.shouldCreatePack = false;
        this.handlePointerDown = (e) => {
            const card = e.currentTarget;
            if (card.dataset.state !== CardState.IDLE)
                return;
            e.preventDefault();
            card.setPointerCapture(e.pointerId);
            // On first interaction, stop wiggle and hide label
            if (!this.hasUserInteracted) {
                this.hasUserInteracted = true;
                this.stopWiggleAnimation();
                this.hideDragLabel();
            }
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
            // If this is potentially the 5th like, fade out background cards proportionally
            if (this.likedCards.length === 4 && this.dragState.deltaX > 0) {
                const fadeProgress = Math.min(Math.abs(this.dragState.deltaX) / 300, 1);
                this.fadeOutBackgroundCards(fadeProgress);
            }
            else if (this.likedCards.length === 4 && this.dragState.deltaX <= 0) {
                // Restore background cards if dragging back
                this.fadeOutBackgroundCards(0);
            }
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
        this.parentElement = container.parentElement;
        this.experiences = experiences;
    }
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    initialize() {
        this.renderCards();
        this.attachEventListeners();
        this.startWiggleAnimation();
    }
    destroy() {
        this.detachEventListeners();
        if (this.rafId)
            cancelAnimationFrame(this.rafId);
        if (this.wiggleIntervalId)
            clearInterval(this.wiggleIntervalId);
    }
    // ========================================================================
    // WIGGLE ANIMATION
    // ========================================================================
    startWiggleAnimation() {
        const triggerWiggle = () => {
            this.cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('wiggle');
                    // Remove class after animation completes
                    setTimeout(() => {
                        card.classList.remove('wiggle');
                    }, 2500);
                }, index * 100); // Stagger by 100ms per card
            });
        };
        // Initial wiggle after 1 second
        setTimeout(triggerWiggle, 1000);
        // Repeat every 10 seconds
        this.wiggleIntervalId = window.setInterval(triggerWiggle, 10000);
    }
    stopWiggleAnimation() {
        if (this.wiggleIntervalId) {
            clearInterval(this.wiggleIntervalId);
            this.wiggleIntervalId = null;
        }
        // Remove wiggle class from all cards
        this.cards.forEach(card => card.classList.remove('wiggle'));
    }
    hideDragLabel() {
        const label = document.querySelector('.card-stack-label');
        if (label) {
            label.classList.add('fade-out');
        }
    }
    fadeOutBackgroundCards(progress) {
        // Fade out all cards except the top one (proportional to progress)
        this.cards.forEach((card, index) => {
            if (index > 0) {
                card.style.transition = 'opacity 0.1s ease';
                card.style.opacity = String(1 - progress);
            }
        });
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
        card.dataset.experienceIndex = String(index);
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
            const y = offset * 6; // Smaller vertical offset for tighter stack
            const x = offset * 2; // Small horizontal shift for depth
            // Very subtle random rotation between -2 and +2 degrees
            const randomRotation = (Math.random() - 0.5) * 14; // -2 to +2 degrees
            const scale = 1 - (offset * 0.02); // Very subtle scale difference
            card.style.setProperty('--stack-y', `${y}px`);
            card.style.setProperty('--stack-x', `${x}px`);
            card.style.setProperty('--stack-rotation', `${randomRotation}deg`);
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
        // Track liked cards
        let isFifthCard = false;
        if (direction === SwipeDirection.RIGHT && card.dataset.experienceIndex) {
            const experienceIndex = parseInt(card.dataset.experienceIndex, 10);
            const experience = this.experiences[experienceIndex];
            if (experience) {
                this.likedCards.push(experience);
                // Check if we have 5 liked cards
                if (this.likedCards.length === 5) {
                    this.shouldCreatePack = true;
                    isFifthCard = true;
                    // Fully fade out background cards
                    this.fadeOutBackgroundCards(1);
                }
            }
        }
        const targetX = direction === SwipeDirection.RIGHT ? 1000 : -1000;
        const targetY = -100;
        const rotation = direction === SwipeDirection.RIGHT ? 30 : -30;
        // Don't fade out the 5th card itself, only background cards
        if (isFifthCard) {
            card.style.transition = `transform ${CONFIG.FLY_OUT_DURATION}ms cubic-bezier(0.4, 0.1, 0.2, 1)`;
        }
        else {
            card.style.transition = `transform ${CONFIG.FLY_OUT_DURATION}ms cubic-bezier(0.4, 0.1, 0.2, 1), opacity ${CONFIG.FLY_OUT_DURATION}ms ease`;
            card.style.opacity = '0';
        }
        card.style.transform = `translate(${targetX}px, ${targetY}px) rotate(${rotation}deg)`;
        setTimeout(() => {
            this.removeCard(card);
            // Create pack after animation completes (skip nextCard)
            if (this.shouldCreatePack) {
                this.shouldCreatePack = false;
                // Show gift pack immediately when card exits
                this.createPack();
            }
            else {
                this.nextCard();
            }
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
        // Restore background cards if this was potentially the 5th card
        if (this.likedCards.length === 4) {
            this.fadeOutBackgroundCards(0);
        }
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
    // ========================================================================
    // PACK CREATION
    // ========================================================================
    createPack() {
        console.log('Pack created with experiences:', this.likedCards);
        // Trigger confetti effect
        this.showConfetti();
        // Replace card stack with gift pack
        this.renderGiftPack();
    }
    showConfetti() {
        const count = 150;
        const defaults = {
            origin: { y: 0.7 },
            zIndex: 9999
        };
        function fire(particleRatio, opts) {
            window.confetti(Object.assign({}, defaults, opts, {
                particleCount: Math.floor(count * particleRatio)
            }));
        }
        // Check if confetti is available
        if (typeof window.confetti === 'function') {
            fire(0.25, {
                spread: 26,
                startVelocity: 55,
            });
            fire(0.2, {
                spread: 60,
            });
            fire(0.35, {
                spread: 100,
                decay: 0.91,
                scalar: 0.8
            });
            fire(0.1, {
                spread: 120,
                startVelocity: 25,
                decay: 0.92,
                scalar: 1.2
            });
            fire(0.1, {
                spread: 120,
                startVelocity: 45,
            });
        }
    }
    renderGiftPack() {
        if (!this.parentElement)
            return;
        // Fade out card stack container quickly
        this.container.style.transition = 'opacity 0.2s ease';
        this.container.style.opacity = '0';
        setTimeout(() => {
            // Hide card stack container
            this.container.style.display = 'none';
            // Create gift pack
            const giftPack = document.createElement('div');
            giftPack.className = 'gift-pack';
            const giftIcon = document.createElement('div');
            giftIcon.className = 'gift-pack__icon';
            giftIcon.textContent = '🎁';
            const header = document.createElement('div');
            header.className = 'gift-pack__header';
            header.innerHTML = `
        <h3><span class="gift-pack__title-gradient">Your Gift Pack is Ready!</span></h3>
        <p>You've selected 5 amazing experiences</p>
      `;
            const grid = document.createElement('div');
            grid.className = 'gift-pack__grid';
            this.likedCards.forEach((experience, index) => {
                const card = document.createElement('a');
                card.className = 'gift-pack__card';
                card.href = experience.url;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
                card.style.animationDelay = `${0.3 + index * 0.1}s`;
                card.innerHTML = `
          <img src="${experience.image}" alt="${experience.alt}" />
        `;
                grid.appendChild(card);
            });
            const actions = document.createElement('div');
            actions.className = 'gift-pack__actions';
            actions.innerHTML = `
        <button class="gift-pack__button gift-pack__button--primary">Share Gift Pack</button>
      `;
            giftPack.appendChild(giftIcon);
            giftPack.appendChild(header);
            giftPack.appendChild(grid);
            giftPack.appendChild(actions);
            this.parentElement.appendChild(giftPack);
            // Fade in and bounce gift pack
            setTimeout(() => {
                this.container.style.transition = 'opacity 0.6s ease';
                this.container.style.opacity = '1';
                giftPack.classList.add('gift-pack--visible');
            }, 50);
            // Add button handler
            const shareButton = actions.querySelector('.gift-pack__button--primary');
            if (shareButton) {
                shareButton.addEventListener('click', () => this.shareGiftPack());
            }
        }, 200);
    }
    shareGiftPack() {
        // Create shareable text
        const text = `Check out my gift pack! 🎁\n\n${this.likedCards.map(exp => exp.title).join('\n')}`;
        // Try native share API
        if (navigator.share) {
            navigator.share({
                title: 'My Gift Pack',
                text: text,
            }).catch(() => {
                // Fallback to clipboard
                this.copyToClipboard(text);
            });
        }
        else {
            // Fallback to clipboard
            this.copyToClipboard(text);
        }
    }
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            // Show temporary success message
            const btn = document.querySelector('.gift-pack__button--primary');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }
        });
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
