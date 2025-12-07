/* Shared utility functions */

export const openInNewTab = (url: string): void => { 
  window.open(url, '_blank', 'noopener'); 
};

// Haptic feedback
export const triggerHaptic = (duration: number = 10): void => {
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    navigator.vibrate(duration);
  }
};

// Disable native image dragging
export const disableNativeImageDrag = (selector: string): void => {
  document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
    img.setAttribute('draggable', 'false');
    img.addEventListener('dragstart', (e) => e.preventDefault());
  });
};
