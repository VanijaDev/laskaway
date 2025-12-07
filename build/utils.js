/* Shared utility functions */
export const openInNewTab = (url) => {
    window.open(url, '_blank', 'noopener');
};
// Haptic feedback
export const triggerHaptic = (duration = 10) => {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(duration);
    }
};
// Disable native image dragging
export const disableNativeImageDrag = (selector) => {
    document.querySelectorAll(selector).forEach((img) => {
        img.setAttribute('draggable', 'false');
        img.addEventListener('dragstart', (e) => e.preventDefault());
    });
};
