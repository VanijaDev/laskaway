/* Easter Egg Module - Fun animations triggered by logo click */
const EASTER_EGG_DURATIONS = {
    RAINBOW_WAVE: 4000,
    CARD_ANIMATION: 2400,
    GENTLE_SWAY: 3000,
    WIND_GUST: 2400,
};
const EASTER_EGG_DELAYS = {
    STACK_CARD_STAGGER: 80,
    CAROUSEL_CARD_STAGGER_DANCE: 100,
    CAROUSEL_CARD_STAGGER_TUMBLE: 120,
};
// Shared helper: Toggle page-level class with auto-cleanup
const togglePageClass = (className, duration) => {
    const page = document.querySelector('.page');
    if (!page)
        return;
    page.classList.add(className);
    setTimeout(() => page.classList.remove(className), duration);
};
// Shared helper: Animate cards with a specific class and animation
const animateCards = (animationClass, animationDuration, stackDelay, carouselDelay) => {
    const stackCards = document.querySelectorAll('.card-stack .card');
    const carouselCards = document.querySelectorAll('.xp-card');
    const giftMinis = document.querySelectorAll('.gift-box__card-mini');
    const runAnimation = (elements, delay) => {
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
    animateCards('card--dancing', EASTER_EGG_DURATIONS.CARD_ANIMATION, EASTER_EGG_DELAYS.STACK_CARD_STAGGER, EASTER_EGG_DELAYS.CAROUSEL_CARD_STAGGER_DANCE);
};
const triggerGentleSway = () => {
    togglePageClass('gentle-sway-active', EASTER_EGG_DURATIONS.GENTLE_SWAY);
};
const triggerTumblingCards = () => {
    animateCards('card--tumbling', EASTER_EGG_DURATIONS.CARD_ANIMATION, EASTER_EGG_DELAYS.STACK_CARD_STAGGER, EASTER_EGG_DELAYS.CAROUSEL_CARD_STAGGER_TUMBLE);
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
export function initializeEasterEgg() {
    const brandLogo = document.getElementById('brandLogo');
    if (!brandLogo)
        return;
    brandLogo.addEventListener('click', triggerRandomEasterEgg);
    brandLogo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerRandomEasterEgg();
        }
    });
}
