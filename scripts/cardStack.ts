/* Card Stack Module - Tinder-like swipeable card stack */

import type { Experience } from '../types';
import { openInNewTab, triggerHaptic, LIKE_EMOJIS, createConfettiParticle, createConfettiEmoji } from '../utils.js';

// Constants

const MAX_SELECTIONS = 5;
const MAX_VISIBLE_CARDS = 3;
const AUTO_DEMO_THRESHOLD = 180;
const isMobileQuery = window.matchMedia('(max-width: 960px)');
const CLICK_TOLERANCE = 5;
const FIFTH_CARD_FADE_MULTIPLIER = 0.5;
const SUCCESS_CONFETTI_RADIUS = { min: 128, max: 480 } as const;
const SUCCESS_CONFETTI_PARTICLES_PER_BURST = 20;
const SUCCESS_CONFETTI_BURSTS = 4;
const ROTATION_FACTOR = 0.08;
const LABEL_INTENSITY_DIVISOR = 120;
const DEMO_ANIMATION_DURATION = 3000;

const WIGGLE_INITIAL_DELAY = 1000;
const WIGGLE_ANIMATION_DURATION = 2000;
const WIGGLE_GAP_BETWEEN = 4000;

const CLICK_BLOCK_DURATION = 800;
const DEFAULT_URL = 'https://www.google.com';

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const getElementCenter = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

type CardLabels = {
  like: HTMLElement | null;
  nope: HTMLElement | null;
};

interface LikedExperience {
  title: string;
  image: string;
  url: string;
}

export function initializeCardStack(experiences: Experience[]): void {
  const stackElement = document.querySelector('.card-stack') as HTMLElement | null;
  if (!stackElement) return;

  const cardStack = new CardStack(stackElement, experiences);
  cardStack.initialize();
}

class CardStack {
  private readonly stack: HTMLElement;
  private readonly experiences: Experience[];
  private readonly prefersReducedMotion: boolean;
  
  private nextExpIndex = 0;
  private activeCards: HTMLElement[] = [];
  private hasInteracted = false;
  private hintDismissed = false;
  private likedExperiences: LikedExperience[] = [];
  
  private isDemoRunning = false;
  private demoRAF: number | null = null;
  
  private readonly giftBox: HTMLElement | null;
  private readonly selectedCardsContainer: HTMLElement | null;
  private readonly dragHint: HTMLElement | null;

  constructor(stack: HTMLElement, experiences: Experience[]) {
    this.stack = stack;
    this.experiences = experiences;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.giftBox = document.getElementById('giftBox');
    this.selectedCardsContainer = document.getElementById('selectedCards');
    this.dragHint = document.getElementById('dragHint');
  }

  initialize(): void {
    this.setupInitialState();
    this.initVirtualCards();
    if (!this.prefersReducedMotion) {
      this.scheduleWiggleAnimations();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopAllWiggles();
          this.cancelDemoIfAny();
        }
      }, { passive: true });
    }
  }

  private setupInitialState(): void {
    this.stack.classList.remove('is-hidden');
    if (this.giftBox) {
      this.giftBox.classList.remove('is-visible');
      if (!this.giftBox.classList.contains('hidden')) {
        this.giftBox.classList.add('hidden');
      }
    }
  }

  private createCard(): HTMLElement {
    const card = document.createElement('figure');
    card.className = 'card card--hint-wiggle';
    card.innerHTML = `
      <img src="" alt="" loading="lazy" />
      <div class="swipe-label swipe-label--like" aria-hidden="true">Gift this!</div>
      <div class="swipe-label swipe-label--nope" aria-hidden="true">Not today</div>
      <figcaption></figcaption>
    `;
    const img = card.querySelector('img') as HTMLImageElement | null;
    if (img) img.draggable = false;
    return card;
  }

  private updateCardContent(card: HTMLElement, exp: Experience): void {
    const img = card.querySelector('img') as HTMLImageElement;
    const caption = card.querySelector('figcaption') as HTMLElement;
    img.src = exp.image;
    img.alt = exp.alt;
    caption.textContent = exp.title;
    card.dataset.title = exp.title;
    card.dataset.url = exp.url;
  }

  private setRandomBase(el: HTMLElement): void {
    const randX = Math.floor(Math.random() * 9 - 4);
    const randY = Math.floor(Math.random() * 9 - 4);
    const randTilt = Math.floor(Math.random() * 13 - 6);
    el.style.setProperty('--base-x', randX + 'px');
    el.style.setProperty('--base-y', randY + 'px');
    el.style.setProperty('--base-r', randTilt + 'deg');
  }

  private initVirtualCards(): void {
    for (let i = 0; i < Math.min(MAX_VISIBLE_CARDS, this.experiences.length); i++) {
      const exp = this.experiences[this.nextExpIndex++];
      const card = this.createCard();
      this.updateCardContent(card, exp);
      this.setRandomBase(card);
      this.stack.appendChild(card);
      this.activeCards.push(card);
      this.attachDragHandlers(card);
    }
  }

  private getTopCard(): HTMLElement | null {
    return this.activeCards[this.activeCards.length - 1] || null;
  }

  private getStackCardsExcept(excludeCard: HTMLElement): HTMLElement[] {
    return this.activeCards.filter(c => c !== excludeCard);
  }

  private updateStackOpacity(excludeCard: HTMLElement, fadeProgress: number): void {
    this.getStackCardsExcept(excludeCard).forEach(c => {
      c.style.opacity = String(1 - fadeProgress);
    });
  }

  private resetStackOpacity(excludeCard: HTMLElement): void {
    this.getStackCardsExcept(excludeCard).forEach(c => {
      c.style.opacity = '';
    });
  }

  private getCardLabels(card: HTMLElement): CardLabels {
    return {
      like: card.querySelector('.swipe-label--like'),
      nope: card.querySelector('.swipe-label--nope')
    };
  }

  private updateLabelOpacity(labels: CardLabels, dx: number, intensity: number): void {
    if (dx > 0) {
      if (labels.like) labels.like.style.opacity = String(intensity);
      if (labels.nope) labels.nope.style.opacity = '0';
    } else if (dx < 0) {
      if (labels.nope) labels.nope.style.opacity = String(intensity);
      if (labels.like) labels.like.style.opacity = '0';
    } else {
      if (labels.like) labels.like.style.opacity = '0';
      if (labels.nope) labels.nope.style.opacity = '0';
    }
  }

  private clearDragTransform(card: HTMLElement): void {
    card.style.removeProperty('--drag-x');
    card.style.removeProperty('--drag-y');
    card.style.removeProperty('--drag-r');
  }

  private resetSwipeLabels(card: HTMLElement): void {
    const labels = this.getCardLabels(card);
    if (labels.like) labels.like.style.opacity = '0';
    if (labels.nope) labels.nope.style.opacity = '0';
  }

  private resetCardState(card: HTMLElement): void {
    card.classList.remove('fly-out-right', 'fly-out-left');
    this.clearDragTransform(card);
    card.style.transition = '';
    card.style.zIndex = '';
    this.resetSwipeLabels(card);
    delete card.dataset.autoAdvanced;
  }

  private applyFifthCardFade(draggedCard: HTMLElement, dx: number): void {
    if (this.likedExperiences.length !== 4) return;
    if (dx <= 0) {
      this.resetStackOpacity(draggedCard);
      return;
    }
    const cardWidth = draggedCard.getBoundingClientRect().width;
    const fullFadeAt = AUTO_DEMO_THRESHOLD + cardWidth * FIFTH_CARD_FADE_MULTIPLIER;
    const fadeProgress = Math.min(1, Math.max(0, dx / fullFadeAt));
    this.updateStackOpacity(draggedCard, fadeProgress);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      window.setTimeout(resolve, ms);
    });
  }

  private scheduleWiggleAnimations(): void {
    window.setTimeout(() => {
      if (!this.hasInteracted) this.startIdleWiggleDemoLoop();
    }, WIGGLE_INITIAL_DELAY);
  }

  private startIdleWiggleDemoLoop(): void {
    const loop = async () => {
      while (!this.hasInteracted) {
        if (document.hidden) {
          await this.sleep(300);
          continue;
        }
        this.triggerWiggle();
        await this.sleep(WIGGLE_ANIMATION_DURATION);

        if (this.hasInteracted) break;
        if (document.hidden) continue;
        await this.sleep(WIGGLE_GAP_BETWEEN);

        if (this.hasInteracted) break;
        if (document.hidden) continue;
        await this.demoTopCardDragOnce();
        
        if (this.hasInteracted) break;
        if (document.hidden) continue;
        await this.sleep(WIGGLE_GAP_BETWEEN);
      }
    };
    void loop();
  }

  private triggerWiggle(): void {
    if (this.hasInteracted) return;
    if (document.hidden) return;
    this.activeCards.forEach((card, i) => {
      card.style.setProperty('--wiggle-delay', 1 + i * 0.3 + 's');
      if (!card.classList.contains('card--hint-wiggle')) {
        card.classList.add('card--hint-wiggle');
      } else {
        card.classList.remove('card--hint-wiggle');
        void card.offsetWidth;
        card.classList.add('card--hint-wiggle');
      }
    });
  }

  private stopAllWiggles(): void {
    this.activeCards.forEach(card => {
      card.classList.remove('card--hint-wiggle');
      card.style.animation = 'none';
    });
  }

  private cancelDemoIfAny(): void {
    if (!this.isDemoRunning) return;
    this.isDemoRunning = false;
    if (this.demoRAF) cancelAnimationFrame(this.demoRAF);
    this.demoRAF = null;
    const topCard = this.getTopCard();
    if (topCard) {
      this.clearDragTransform(topCard);
      this.resetSwipeLabels(topCard);
    }
  }

  private demoTopCardDragOnce(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.hasInteracted || this.isDemoRunning) return resolve();
      const card = this.getTopCard();
      if (!card) return resolve();

      this.isDemoRunning = true;
      card.classList.remove('card--hint-wiggle');
      void card.offsetWidth;

      const labels = this.getCardLabels(card);
      const autoThreshold = isMobileQuery.matches ? AUTO_DEMO_THRESHOLD / 2 : AUTO_DEMO_THRESHOLD;
      const start = performance.now();

      const step = (now: number) => {
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
        } else if (progress < 0.66) {
          const phaseProgress = easeInOutCubic((progress - 0.33) / 0.33);
          dx = -autoThreshold + (2 * autoThreshold * phaseProgress);
          dy = -Math.abs(Math.sin(phaseProgress * Math.PI)) * 15;
        } else {
          const phaseProgress = easeInOutCubic((progress - 0.66) / 0.34);
          dx = autoThreshold * (1 - phaseProgress);
          dy = -Math.abs(Math.sin(phaseProgress * Math.PI)) * 10;
        }

        const rot = dx * ROTATION_FACTOR;
        card.style.setProperty('--drag-x', dx + 'px');
        card.style.setProperty('--drag-y', dy + 'px');
        card.style.setProperty('--drag-r', rot + 'deg');
        const intensity = Math.min(1, Math.abs(dx) / LABEL_INTENSITY_DIVISOR);

        this.updateLabelOpacity(labels, dx, intensity);

        if (progress < 1) {
          this.demoRAF = requestAnimationFrame(step);
        } else {
          this.clearDragTransform(card);
          this.resetSwipeLabels(card);
          this.isDemoRunning = false;
          this.demoRAF = null;
          resolve();
        }
      };

      this.demoRAF = requestAnimationFrame(step);
    });
  }

  private attachDragHandlers(card: HTMLElement): void {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    let moved = false;
    let blockClickUntil = 0;
    let pointerId: number | null = null;
    const labels = this.getCardLabels(card);

    let prevBodyOverflow: string = '';
    let prevBodyTouchAction: string = '';
    const onPointerDown = (e: PointerEvent) => {
      if (card !== this.getTopCard()) return;
      e.preventDefault();
      // Save previous body styles
      prevBodyOverflow = document.body.style.overflow;
      prevBodyTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      this.cancelDemoIfAny();
      pointerId = e.pointerId;
      card.setPointerCapture(pointerId);
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      card.classList.add('is-dragging');
      card.style.transition = 'none';
      card.style.zIndex = '10';
      if (!this.hasInteracted) {
        this.hasInteracted = true;
        this.stopAllWiggles();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      if (!moved && (Math.abs(dx) > CLICK_TOLERANCE || Math.abs(dy) > CLICK_TOLERANCE)) {
        moved = true;
      }
      const rot = dx * ROTATION_FACTOR;
      card.style.setProperty('--drag-x', dx + 'px');
      card.style.setProperty('--drag-y', dy + 'px');
      card.style.setProperty('--drag-r', rot + 'deg');

      const intensity = Math.min(1, Math.abs(dx) / LABEL_INTENSITY_DIVISOR);
      this.updateLabelOpacity(labels, dx, intensity);
      this.applyFifthCardFade(card, dx);

      if (Math.abs(dx) > AUTO_DEMO_THRESHOLD && !card.dataset.autoAdvanced) {
        card.dataset.autoAdvanced = 'true';
        triggerHaptic(20);
      }
    };

    const onPointerUp = () => {
      if (!dragging) return;
      if (pointerId !== null) card.releasePointerCapture(pointerId);
      dragging = false;
      card.classList.remove('is-dragging');
      // Restore previous body styles
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;

      if (Math.abs(dx) < CLICK_TOLERANCE && Math.abs(dy) < CLICK_TOLERANCE) {
        card.style.transition = '';
        card.style.zIndex = '';
        delete card.dataset.autoAdvanced;
        this.resetSwipeLabels(card);
        this.clearDragTransform(card);
        moved = false;
        dx = dy = 0;
        return;
      }

      blockClickUntil = Date.now() + CLICK_BLOCK_DURATION;
      const dirRight = dx > 0;

      if (Math.abs(dx) >= AUTO_DEMO_THRESHOLD) {
        // Directly commit fly-out; do not reset transition/zIndex here
        this.handleSwipeCommit(card, dirRight, labels);
      } else {
        card.style.transition = '';
        card.style.zIndex = '';
        this.handleSnapBack(card);
      }
      dx = dy = 0;
    };

    const onClick = (evt: Event) => {
      if (dragging || moved || Date.now() < blockClickUntil) {
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }
      const url = card.dataset.url || DEFAULT_URL;
      openInNewTab(url);
    };

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
    card.addEventListener('pointercancel', onPointerUp);
    card.addEventListener('lostpointercapture', onPointerUp);
    card.addEventListener('click', onClick);
  }

  private handleSwipeCommit(card: HTMLElement, dirRight: boolean, labels: CardLabels): void {
    const flyOutDuration = 0.5;
    card.style.transition = `transform ${flyOutDuration}s ease-in, opacity ${flyOutDuration}s ease-in`;
    card.style.zIndex = '99';
    // Ensure browser picks up the new transition before we change classes
    void card.offsetWidth;

    if (dirRight) {
      this.handleLikeAction(card, labels);
    } else {
      this.handleNopeAction(labels);
    }

    if (!this.hintDismissed) {
      this.dragHint?.classList.add('drag-hint--fade');
      this.hintDismissed = true;
    }

    card.classList.add(dirRight ? 'fly-out-right' : 'fly-out-left');

    let cleaned = false;
    const handleEnd = () => {
      if (cleaned) return;
      cleaned = true;
      card.removeEventListener('transitionend', handleEnd);
      this.cleanupSwipedCard(card, dirRight);
    };
    card.addEventListener('transitionend', handleEnd);
    // Safety timeout in case transitionend doesn't fire on some mobile browsers
    setTimeout(() => handleEnd(), (flyOutDuration + 0.1) * 1000);
  }

  private handleLikeAction(card: HTMLElement, labels: CardLabels): void {
    const title = card.dataset.title || '';
    const url = card.dataset.url || '';
    const imgEl = card.querySelector('img');
    const image = imgEl ? imgEl.src : '';
    this.likedExperiences.push({ title, image, url });

    if (!this.prefersReducedMotion) {
      this.showCountNumber(this.likedExperiences.length);
      this.createLikeEmojiConfetti(card);
    }

    if (labels.like) {
      labels.like.style.opacity = '1';
      labels.like.classList.add('shake-right');
      setTimeout(() => labels.like?.classList.remove('shake-right'), 220);
    }
  }

  private handleNopeAction(labels: CardLabels): void {
    if (labels.nope) {
      labels.nope.style.opacity = '1';
      labels.nope.classList.add('shake-left');
      setTimeout(() => labels.nope?.classList.remove('shake-left'), 220);
    }
  }

  private handleSnapBack(card: HTMLElement): void {
    card.classList.add('snap-back');
    this.clearDragTransform(card);
    delete card.dataset.autoAdvanced;
    this.resetSwipeLabels(card);
    this.resetStackOpacity(card);

    const handleBack = () => {
      card.classList.remove('snap-back');
      card.style.transition = '';
      card.style.zIndex = '';
      card.removeEventListener('transitionend', handleBack);
      card.classList.add('haptic-bounce');
      setTimeout(() => card.classList.remove('haptic-bounce'), 200);
    };
    card.addEventListener('transitionend', handleBack);
  }

  private cleanupSwipedCard(card: HTMLElement, dirRight: boolean): void {
    this.resetCardState(card);

    if (this.likedExperiences.length >= MAX_SELECTIONS) {
      this.showGiftBox();
      return;
    }

    const topIdx = this.activeCards.indexOf(card);
    if (topIdx > -1) {
      this.activeCards.splice(topIdx, 1);
    }

    if (this.nextExpIndex < this.experiences.length && this.likedExperiences.length < MAX_SELECTIONS) {
      this.recycleCard(card);
    } else {
      card.remove();
    }

    if (dirRight) {
      this.applyDribbleEffect();
    }
  }

  private recycleCard(card: HTMLElement): void {
    const nextExp = this.experiences[this.nextExpIndex++];
    this.updateCardContent(card, nextExp);
    this.resetCardState(card);
    this.setRandomBase(card);
    this.stack.insertBefore(card, this.stack.firstChild);
    this.activeCards.unshift(card);

    const others = this.activeCards.slice(0, -1);
    others.forEach(c => c.classList.add('base-animate'));
    this.setRandomBase(this.activeCards[0]);
    setTimeout(() => others.forEach(c => c.classList.remove('base-animate')), 240);
  }

  private applyDribbleEffect(): void {
    setTimeout(() => {
      const others = this.activeCards.slice(0, -1);
      if (others.length > 0) {
        others.forEach((c, idx) => {
          const randomDelay = Math.random() * 80;
          setTimeout(() => {
            c.classList.add('dribble');
            setTimeout(() => c.classList.remove('dribble'), 320);
          }, idx * 60 + randomDelay);
        });
      }
    }, 200);
  }

  private showGiftBox(): void {
    if (this.stack) {
      this.stack.classList.add('is-hidden');
      window.setTimeout(() => {
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
      this.giftBox.focus();
    }
  }

  private populateMiniCards(): void {
    if (!this.selectedCardsContainer) return;
    this.likedExperiences.forEach(exp => {
      const mini = document.createElement('div');
      mini.className = 'gift-box__card-mini';
      mini.innerHTML = `<img src="${exp.image}" alt="${exp.title}" />`;
      mini.title = exp.title;
      mini.style.cursor = 'pointer';
      mini.addEventListener('click', () => openInNewTab(exp.url));
      this.selectedCardsContainer!.appendChild(mini);
    });
  }

  private getStackBandCenter() {
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

  private showCountNumber(countNumber: number): void {
    const { x: centerX, y: centerY } = this.getStackBandCenter();
    const num = document.createElement('div');
    num.className = 'confetti-number';
    num.textContent = String(countNumber);
    const dx = 140 + Math.random() * 100;
    const dy = -(60 + Math.random() * 80);
    const rot = Math.floor(Math.random() * 40 - 20);
    num.style.left = centerX + 'px';
    num.style.top = centerY + 'px';
    num.style.setProperty('--dx', dx + 'px');
    num.style.setProperty('--dy', dy + 'px');
    num.style.setProperty('--rot', rot + 'deg');
    num.style.setProperty('--dur', '1400ms');
    num.style.setProperty('--delay', '0ms');
    document.body.appendChild(num);
    num.addEventListener('animationend', () => num.remove());
  }

  private createLikeEmojiConfetti(card: HTMLElement): void {
    const { x: cx, y: cy } = getElementCenter(card);
    for (let i = 0; i < 4; i++) {
      const emoji = LIKE_EMOJIS[(Math.random() * LIKE_EMOJIS.length) | 0];
      const emojiEl = document.createElement('div');
      emojiEl.className = 'confetti-emoji';
      emojiEl.textContent = emoji;
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 60;
      const emDx = Math.cos(angle) * dist;
      const emDy = Math.sin(angle) * dist;
      emojiEl.style.left = cx + 'px';
      emojiEl.style.top = cy + 'px';
      emojiEl.style.setProperty('--dx', emDx + 'px');
      emojiEl.style.setProperty('--dy', emDy + 'px');
      emojiEl.style.setProperty('--dur', (900 + Math.random() * 300) + 'ms');
      emojiEl.style.setProperty('--delay', ((i * 40) | 0) + 'ms');
      emojiEl.style.setProperty('--emojiSize', (24 + Math.random() * 8) + 'px');
      document.body.appendChild(emojiEl);
      emojiEl.addEventListener('animationend', () => emojiEl.remove());
    }
  }

  private fireConfetti(targetElement: HTMLElement): void {
    const { x: centerX, y: centerY } = getElementCenter(targetElement);

    const emit = () => {
      for (let i = 0; i < SUCCESS_CONFETTI_PARTICLES_PER_BURST; i++) {
        const isEmoji = Math.random() < 0.15;
        const angle = Math.random() * Math.PI * 2;
        const distance = SUCCESS_CONFETTI_RADIUS.min + Math.random() * (SUCCESS_CONFETTI_RADIUS.max - SUCCESS_CONFETTI_RADIUS.min);
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;

        if (isEmoji) {
          const em = createConfettiEmoji(centerX, centerY, dx, dy, LIKE_EMOJIS);
          em.style.setProperty('--emojiSize', (20 + Math.random() * 10) + 'px');
          document.body.appendChild(em);
          em.addEventListener('animationend', () => em.remove());
        } else {
          const piece = createConfettiParticle(centerX, centerY, dx, dy);
          document.body.appendChild(piece);
          piece.addEventListener('animationend', () => piece.remove());
        }
      }
    };

    for (let b = 0; b < SUCCESS_CONFETTI_BURSTS; b++) {
      setTimeout(emit, b * 100);
    }
  }
}
