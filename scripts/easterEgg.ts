/* Easter Egg Module - Fun animations triggered by logo click */

const EASTER_EGG_DURATIONS = {
  RAINBOW_WAVE: 4000,
  CARD_ANIMATION: 2400,
  GENTLE_SWAY: 3000,
  WIND_GUST: 2400,
} as const;

const EASTER_EGG_DELAYS = {
  STACK_CARD_STAGGER: 80,
  CAROUSEL_CARD_STAGGER_DANCE: 100,
  CAROUSEL_CARD_STAGGER_TUMBLE: 120,
} as const;

// Shared helper: Toggle page-level class with auto-cleanup
const togglePageClass = (className: string, duration: number) => {
  const page = document.querySelector('.page') as HTMLElement | null;
  if (!page) return;
  page.classList.add(className);
  setTimeout(() => page.classList.remove(className), duration);
};

// Shared helper: Animate cards with a specific class and animation
const animateCards = (
  animationClass: string,
  animationDuration: number,
  animationName: string,
  stackDelay: number,
  carouselDelay: number
) => {
  const stackCards = document.querySelectorAll<HTMLElement>('.card-stack .card');
  const carouselCards = document.querySelectorAll<HTMLElement>('.xp-card');
  const giftMinis = document.querySelectorAll<HTMLElement>('.gift-box__card-mini');
  
  // Animate swipeable stack cards
  stackCards.forEach((card, idx) => {
    setTimeout(() => {
      card.classList.add(animationClass);
      setTimeout(() => card.classList.remove(animationClass), animationDuration);
    }, idx * stackDelay);
  });
  
  // Animate gift box mini-cards the same way as stack cards
  giftMinis.forEach((mini, idx) => {
    setTimeout(() => {
      mini.classList.add(animationClass);
      setTimeout(() => mini.classList.remove(animationClass), animationDuration);
    }, idx * stackDelay);
  });
  
  // Animate carousel cards via keyframes
  carouselCards.forEach((card, idx) => {
    setTimeout(() => {
      card.style.animation = 'none';
      // Force reflow
      void card.offsetHeight;
      card.style.animation = `${animationName} ${animationDuration}ms cubic-bezier(0.4, 0.0, 0.2, 1) forwards`;
      setTimeout(() => {
        card.style.animation = '';
      }, animationDuration);
    }, idx * carouselDelay);
  });
};

const triggerRainbowWave = () => {
  togglePageClass('rainbow-wave-active', EASTER_EGG_DURATIONS.RAINBOW_WAVE);
};

const triggerDancingCards = () => {
  animateCards(
    'card--dancing',
    EASTER_EGG_DURATIONS.CARD_ANIMATION,
    'card-dance',
    EASTER_EGG_DELAYS.STACK_CARD_STAGGER,
    EASTER_EGG_DELAYS.CAROUSEL_CARD_STAGGER_DANCE
  );
};

const triggerGentleSway = () => {
  togglePageClass('gentle-sway-active', EASTER_EGG_DURATIONS.GENTLE_SWAY);
};

const triggerTumblingCards = () => {
  animateCards(
    'card--tumbling',
    EASTER_EGG_DURATIONS.CARD_ANIMATION,
    'card-tumble',
    EASTER_EGG_DELAYS.STACK_CARD_STAGGER,
    EASTER_EGG_DELAYS.CAROUSEL_CARD_STAGGER_TUMBLE
  );
};

const triggerWindGust = () => {
  togglePageClass('wind-gust-active', EASTER_EGG_DURATIONS.WIND_GUST);
};

const easterEggEffects = [
  triggerRainbowWave,
  triggerDancingCards,
  triggerGentleSway,
  triggerTumblingCards,
  triggerWindGust,
];

const triggerRandomEasterEgg = () => {
  const randomEffect = easterEggEffects[Math.floor(Math.random() * easterEggEffects.length)];
  randomEffect();
};

export function initializeEasterEgg(): void {
  const brandLogo = document.getElementById('brandLogo') as HTMLElement | null;
  if (!brandLogo) return;

  brandLogo.addEventListener('click', triggerRandomEasterEgg);
  brandLogo.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerRandomEasterEgg();
    }
  });
}
