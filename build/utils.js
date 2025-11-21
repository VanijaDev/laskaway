/* Shared utility functions */
export const COLORS = ['#7c5cff', '#ec4899', '#f59e0b', '#60a5fa', '#10b981', '#f43f5e'];
export const LIKE_EMOJIS = ['✨', '🎉', '💖', '🥳', '💯', '🤪', '😍', '🙌', '🥰', '🤩', '👌'];
export const openInNewTab = (url) => {
    window.open(url, '_blank', 'noopener');
};
export const setAriaInvalid = (el, isInvalid) => {
    if (!el)
        return;
    if (isInvalid)
        el.setAttribute('aria-invalid', 'true');
    else
        el.removeAttribute('aria-invalid');
};
// Shared confetti particle builder
export const createConfettiParticle = (x, y, dx, dy) => {
    const shapes = ['square', 'circle', 'triangle', 'ribbon'];
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const rot = Math.floor(Math.random() * 720 - 360);
    piece.style.left = x + 'px';
    piece.style.top = y + 'px';
    piece.style.setProperty('--dx', dx + 'px');
    piece.style.setProperty('--dy', dy + 'px');
    piece.style.setProperty('--rot', rot + 'deg');
    piece.style.setProperty('--dur', (1400 + Math.random() * 1000) + 'ms');
    piece.style.setProperty('--delay', ((Math.random() * 120) | 0) + 'ms');
    piece.style.setProperty('--scale', (0.9 + Math.random() * 0.6).toFixed(2));
    const shape = shapes[(Math.random() * shapes.length) | 0];
    const color = COLORS[(Math.random() * COLORS.length) | 0];
    if (shape === 'circle') {
        piece.style.borderRadius = '50%';
    }
    else if (shape === 'triangle') {
        piece.style.width = '0';
        piece.style.height = '0';
        piece.style.borderLeft = '8px solid transparent';
        piece.style.borderRight = '8px solid transparent';
        piece.style.borderBottom = `16px solid ${color}`;
        piece.style.background = 'none';
    }
    else if (shape === 'ribbon') {
        piece.style.width = '16px';
        piece.style.height = '6px';
        piece.style.background = color;
    }
    else {
        piece.style.background = color;
    }
    return piece;
};
// Shared emoji confetti builder
export const createConfettiEmoji = (x, y, dx, dy, emojis) => {
    const emoji = emojis[(Math.random() * emojis.length) | 0];
    const em = document.createElement('div');
    em.className = 'confetti-emoji';
    em.textContent = emoji;
    em.style.left = x + 'px';
    em.style.top = y + 'px';
    em.style.setProperty('--dx', dx + 'px');
    em.style.setProperty('--dy', dy + 'px');
    em.style.setProperty('--dur', (1200 + Math.random() * 600) + 'ms');
    em.style.setProperty('--delay', ((Math.random() * 80) | 0) + 'ms');
    return em;
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
