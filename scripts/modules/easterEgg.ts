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
  stackDelay: number,
  carouselDelay: number
) => {
  const stackCards = document.querySelectorAll<HTMLElement>('.card-stack .card');
  const carouselCards = document.querySelectorAll<HTMLElement>('.xp-card');
  const giftMinis = document.querySelectorAll<HTMLElement>('.gift-box__card-mini');

  const runAnimation = (elements: Iterable<HTMLElement>, delay: number) => {
    Array.from(elements).forEach((el, idx) => {
      setTimeout(() => {
        el.classList.add(animationClass);
        setTimeout(() => el.classList.remove(animationClass), animationDuration);
      }, idx * delay);
    });
  };

  runAnimation(stackCards, stackDelay);
  runAnimation(giftMinis, stackDelay);
  runAnimation(carouselCards, carouselDelay);
};

const triggerRainbowWave = () => {
  togglePageClass('rainbow-wave-active', EASTER_EGG_DURATIONS.RAINBOW_WAVE);
};

const triggerDancingCards = () => {
  animateCards(
    'card--dancing',
    EASTER_EGG_DURATIONS.CARD_ANIMATION,
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
