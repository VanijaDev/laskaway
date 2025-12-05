/* Easter Egg Module - Fun animations triggered by logo click */
const EASTER_EGG_DURATIONS = {
    RAINBOW_WAVE: 4000,
    GENTLE_SWAY: 3000,
    WIND_GUST: 2400,
};
// Shared helper: Toggle page-level class with auto-cleanup
const togglePageClass = (className, duration) => {
    const page = document.querySelector('.page');
    if (!page)
        return;
    page.classList.add(className);
    setTimeout(() => page.classList.remove(className), duration);
};
const triggerRainbowWave = () => {
    togglePageClass('rainbow-wave-active', EASTER_EGG_DURATIONS.RAINBOW_WAVE);
};
const triggerGentleSway = () => {
    togglePageClass('gentle-sway-active', EASTER_EGG_DURATIONS.GENTLE_SWAY);
};
const triggerWindGust = () => {
    togglePageClass('wind-gust-active', EASTER_EGG_DURATIONS.WIND_GUST);
};
const easterEggEffects = [
    triggerRainbowWave,
    triggerGentleSway,
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
