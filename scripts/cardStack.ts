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

import type { Experience } from '../types';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  VISIBLE_CARDS: 3,           // Number of cards visible in stack
  SWIPE_THRESHOLD: 100,       // Pixels to trigger swipe
  VELOCITY_THRESHOLD: 0.5,    // px/ms velocity to trigger swipe
  FLY_OUT_DURATION: 400,      // ms for card to fly out
  STACK_OFFSET_Y: 8,          // Vertical offset per card in stack
  STACK_OFFSET_X: 0,          // Horizontal offset per card in stack
  STACK_ROTATION: 2,          // Rotation offset per card (degrees)
  STACK_SCALE: 0.95,          // Scale reduction per card
} as const;

// Card states for state machine
enum CardState {
  IDLE = 'idle',
  DRAGGING = 'dragging',
  ANIMATING = 'animating',
  FLYING_OUT = 'flying-out',
}

// Direction for swipe actions
enum SwipeDirection {
  LEFT = 'left',
  RIGHT = 'right',
}

// ============================================================================
// INTERFACES
// ============================================================================

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  startTime: number;
  velocity: number;
}

interface CardElement extends HTMLElement {
  dataset: {
    index?: string;
    state?: CardState;
  };
}

// ============================================================================
// CARD STACK CLASS
// ============================================================================

export class CardStack {
  private container: HTMLElement;
  private experiences: Experience[];
  private currentIndex: number = 0;
  private cards: CardElement[] = [];
  private dragState: DragState | null = null;
  private rafId: number | null = null;
  private wiggleIntervalId: number | null = null;
  private hasUserInteracted: boolean = false;

  constructor(container: HTMLElement, experiences: Experience[]) {
    this.container = container;
    this.experiences = experiences;
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  public initialize(): void {
    this.renderCards();
    this.attachEventListeners();
    this.startWiggleAnimation();
  }

  public destroy(): void {
    this.detachEventListeners();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.wiggleIntervalId) clearInterval(this.wiggleIntervalId);
  }

  // ========================================================================
  // WIGGLE ANIMATION
  // ========================================================================

  private startWiggleAnimation(): void {
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

  private stopWiggleAnimation(): void {
    if (this.wiggleIntervalId) {
      clearInterval(this.wiggleIntervalId);
      this.wiggleIntervalId = null;
    }
    // Remove wiggle class from all cards
    this.cards.forEach(card => card.classList.remove('wiggle'));
  }

  private hideDragLabel(): void {
    const label = document.querySelector('.card-stack-label');
    if (label) {
      label.classList.add('fade-out');
    }
  }

  // ========================================================================
  // CARD RENDERING
  // ========================================================================

  private renderCards(): void {
    // Clear existing cards
    this.container.innerHTML = '';
    this.cards = [];

    // Render only visible cards
    const endIndex = Math.min(
      this.currentIndex + CONFIG.VISIBLE_CARDS,
      this.experiences.length
    );

    for (let i = this.currentIndex; i < endIndex; i++) {
      const card = this.createCard(this.experiences[i], i);
      this.cards.push(card);
      this.container.appendChild(card);
    }

    // Apply stack positioning
    this.updateStackPositions();
  }

  private createCard(experience: Experience, index: number): CardElement {
    const card = document.createElement('article') as CardElement;
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

  private updateStackPositions(): void {
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

  private attachEventListeners(): void {
    const topCard = this.cards[0];
    if (!topCard) return;

    topCard.addEventListener('pointerdown', this.handlePointerDown);
  }

  private detachEventListeners(): void {
    const topCard = this.cards[0];
    if (!topCard) return;

    topCard.removeEventListener('pointerdown', this.handlePointerDown);
  }

  private handlePointerDown = (e: PointerEvent): void => {
    const card = e.currentTarget as CardElement;
    if (card.dataset.state !== CardState.IDLE) return;

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

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.dragState) return;

    const card = e.currentTarget as CardElement;
    
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

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.dragState) return;

    const card = e.currentTarget as CardElement;
    card.releasePointerCapture(e.pointerId);
    
    card.removeEventListener('pointermove', this.handlePointerMove);
    card.removeEventListener('pointerup', this.handlePointerUp);
    card.removeEventListener('pointercancel', this.handlePointerUp);

    // Determine if swipe was committed
    const shouldSwipe = 
      Math.abs(this.dragState.deltaX) > CONFIG.SWIPE_THRESHOLD ||
      this.dragState.velocity > CONFIG.VELOCITY_THRESHOLD;

    if (shouldSwipe) {
      const direction = this.dragState.deltaX > 0 ? SwipeDirection.RIGHT : SwipeDirection.LEFT;
      this.commitSwipe(card, direction);
    } else {
      this.cancelSwipe(card);
    }

    this.dragState = null;
  };

  // ========================================================================
  // ANIMATION & TRANSFORM
  // ========================================================================

  private updateCardTransform(card: CardElement): void {
    if (!this.dragState) return;

    const { deltaX, deltaY } = this.dragState;
    const rotation = (deltaX / 20);

    card.style.transform = `
      translate(${deltaX}px, ${deltaY}px)
      rotate(${rotation}deg)
    `;
  }

  private updateSwipeIndicators(card: CardElement): void {
    if (!this.dragState) return;

    const likeIndicator = card.querySelector('.swipe-indicator--like') as HTMLElement;
    const nopeIndicator = card.querySelector('.swipe-indicator--nope') as HTMLElement;

    const progress = Math.min(Math.abs(this.dragState.deltaX) / CONFIG.SWIPE_THRESHOLD, 1);
    const opacity = progress * 0.8;

    if (this.dragState.deltaX > 0) {
      likeIndicator.style.opacity = String(opacity);
      nopeIndicator.style.opacity = '0';
    } else {
      nopeIndicator.style.opacity = String(opacity);
      likeIndicator.style.opacity = '0';
    }
  }

  private commitSwipe(card: CardElement, direction: SwipeDirection): void {
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

  private cancelSwipe(card: CardElement): void {
    card.dataset.state = CardState.ANIMATING;
    card.classList.remove('is-dragging');

    card.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    card.style.transform = '';

    // Reset indicators
    const indicators = card.querySelectorAll('.swipe-indicator') as NodeListOf<HTMLElement>;
    indicators.forEach(indicator => indicator.style.opacity = '0');

    setTimeout(() => {
      card.dataset.state = CardState.IDLE;
      card.style.transition = '';
    }, 300);
  }

  private removeCard(card: CardElement): void {
    card.remove();
    this.cards.shift();
  }

  private nextCard(): void {
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
    } else {
      this.showCompletionState();
    }
  }

  private showCompletionState(): void {
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

export function initializeCardStack(experiences: Experience[]): void {
  const container = document.querySelector('.card-stack') as HTMLElement | null;
  if (!container || experiences.length === 0) return;

  const cardStack = new CardStack(container, experiences);
  cardStack.initialize();
}
