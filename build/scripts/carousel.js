/* Carousel Module - Virtual scrolling infinite carousel */
import { openInNewTab } from '../utils.js';
// Track recent drag to prevent clicks
let justDraggedUntil = 0;
// Store filtered experiences for virtual scrolling
let filteredExperiences = [];
// Generate empty carousel container (cards created dynamically)
export function generateCarousel(_experiences) {
    return ''; // Virtual scrolling will create cards dynamically
}
// Initialize carousel with virtual scrolling and drag support
export function initializeCarousel(experiences) {
    filteredExperiences = [...experiences];
    const track = document.querySelector('.scroller__track');
    const scroller = document.querySelector('.scroller');
    if (!track || !scroller || filteredExperiences.length === 0)
        return;
    // Environment detection
    const isDesktopHover = window.matchMedia('(hover: hover)').matches;
    const isMobileEnv = window.matchMedia('(hover: none)').matches;
    // Auto-scroll pause state
    let isAutoScrollPaused = false;
    const pauseAutoScroll = () => { isAutoScrollPaused = true; };
    const resumeAutoScroll = () => { isAutoScrollPaused = false; };
    // Constants
    const CARD_WIDTH = 340;
    const GAP = 32;
    const ITEM_WIDTH = CARD_WIDTH + GAP;
    const SCROLL_SPEED_PX_PER_SEC = 80;
    const VISIBLE_BUFFER = 2; // Extra cards on each side
    const DRAG_THRESHOLD = 6;
    const MAX_DELTA_TIME = 0.1;
    // Virtual scrolling state
    let scrollPosition = 0; // Virtual scroll position (continuously growing)
    let lastTs = 0;
    let draggingScroller = false;
    let maybeDrag = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    // Card pool for reuse
    const cardPool = [];
    const activeCards = new Map();
    // Setup track for absolute positioning
    track.style.position = 'relative';
    track.style.height = '220px';
    track.style.overflow = 'visible';
    track.style.animation = 'none';
    // Create or reuse a card element
    const getOrCreateCard = () => {
        let card = cardPool.pop();
        if (!card) {
            card = document.createElement('article');
            card.className = 'xp-card';
            card.style.position = 'absolute';
            card.style.top = '0';
            card.style.width = `${CARD_WIDTH}px`;
            const img = document.createElement('img');
            img.draggable = false;
            card.appendChild(img);
            const label = document.createElement('div');
            label.className = 'xp-card__label';
            card.appendChild(label);
        }
        return card;
    };
    // Return card to pool
    const recycleCard = (card) => {
        card.remove();
        cardPool.push(card);
    };
    // Update card with experience data
    const updateCard = (card, exp, virtualIndex) => {
        const img = card.querySelector('img');
        const label = card.querySelector('.xp-card__label');
        img.src = exp.image;
        img.alt = exp.alt;
        label.textContent = exp.title;
        card.dataset.tags = JSON.stringify(exp.tags);
        card.dataset.url = exp.url;
        card.dataset.virtualIndex = String(virtualIndex);
        card.setAttribute('role', 'link');
        card.setAttribute('tabindex', '0');
        // Attach click handler if not already present
        if (!card.dataset.hasClickHandler) {
            card.addEventListener('click', () => {
                if (Date.now() < justDraggedUntil)
                    return;
                openInNewTab(card.dataset.url || 'https://www.google.com');
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openInNewTab(card.dataset.url || 'https://www.google.com');
                }
            });
            card.dataset.hasClickHandler = 'true';
        }
        // Desktop hover pause/resume
        if (isDesktopHover && !card.dataset.hoverBound) {
            card.addEventListener('mouseenter', pauseAutoScroll);
            card.addEventListener('mouseleave', () => {
                // Only resume if not dragging at the moment
                if (!draggingScroller)
                    resumeAutoScroll();
            });
            card.dataset.hoverBound = 'true';
        }
    };
    // Update visible cards based on scroll position
    const updateVisibleCards = () => {
        if (filteredExperiences.length === 0) {
            activeCards.forEach(card => recycleCard(card));
            activeCards.clear();
            return;
        }
        const viewportWidth = scroller.getBoundingClientRect().width;
        // Calculate which virtual indices should be visible
        const startIndex = Math.floor(scrollPosition / ITEM_WIDTH) - VISIBLE_BUFFER;
        const endIndex = Math.ceil((scrollPosition + viewportWidth) / ITEM_WIDTH) + VISIBLE_BUFFER;
        const neededIndices = new Set();
        for (let i = startIndex; i <= endIndex; i++) {
            neededIndices.add(i);
        }
        // Remove cards that are no longer visible
        activeCards.forEach((card, idx) => {
            if (!neededIndices.has(idx)) {
                recycleCard(card);
                activeCards.delete(idx);
            }
        });
        // Update positions of all active cards
        activeCards.forEach((card, idx) => {
            card.style.left = `${idx * ITEM_WIDTH - scrollPosition}px`;
        });
        // Add newly visible cards
        neededIndices.forEach(virtualIndex => {
            if (activeCards.has(virtualIndex))
                return;
            // Get the experience for this index (wrap around)
            const expIndex = ((virtualIndex % filteredExperiences.length) + filteredExperiences.length) % filteredExperiences.length;
            const exp = filteredExperiences[expIndex];
            // Get or create card element
            const card = getOrCreateCard();
            updateCard(card, exp, virtualIndex);
            // Position card
            card.style.left = `${virtualIndex * ITEM_WIDTH - scrollPosition}px`;
            activeCards.set(virtualIndex, card);
            track.appendChild(card);
        });
    };
    // Animation loop
    const tick = (ts) => {
        if (!lastTs)
            lastTs = ts;
        let dt = (ts - lastTs) / 1000;
        dt = Math.min(dt, MAX_DELTA_TIME);
        lastTs = ts;
        if (!draggingScroller && !isAutoScrollPaused && dt > 0 && filteredExperiences.length > 0) {
            scrollPosition += SCROLL_SPEED_PX_PER_SEC * dt;
            updateVisibleCards();
        }
        requestAnimationFrame(tick);
    };
    // Initialize
    updateVisibleCards();
    requestAnimationFrame(tick);
    // Drag handlers
    const onPointerDown = (e) => {
        maybeDrag = true;
        draggingScroller = false;
        dragStartX = e.clientX;
        dragStartScroll = scrollPosition;
        // Mobile: pause auto scroll on any interaction start
        console.log('Pointer down');
        if (isMobileEnv)
            pauseAutoScroll();
    };
    const onPointerMove = (e) => {
        const dx = e.clientX - dragStartX;
        if (!draggingScroller) {
            if (!maybeDrag)
                return;
            if (Math.abs(dx) < DRAG_THRESHOLD)
                return;
            draggingScroller = true;
            // Prevent page scrolling during carousel drag
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            try {
                scroller.setPointerCapture?.(e.pointerId);
            }
            catch { }
        }
        scrollPosition = dragStartScroll - dx;
        updateVisibleCards();
        e.preventDefault();
    };
    const onPointerUp = (e) => {
        console.log('Pointer up');
        if (draggingScroller) {
            justDraggedUntil = Date.now() + 100;
            // Re-enable page scrolling
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            try {
                scroller.releasePointerCapture?.(e.pointerId);
            }
            catch { }
        }
        maybeDrag = false;
        draggingScroller = false;
        // Resume after mobile interaction ends
        if (isMobileEnv)
            resumeAutoScroll();
    };
    scroller.addEventListener('pointerdown', onPointerDown);
    scroller.addEventListener('pointermove', onPointerMove);
    scroller.addEventListener('pointerup', onPointerUp);
    scroller.addEventListener('pointercancel', onPointerUp);
    // Tag filtering
    const applyFilter = (tag) => {
        if (tag === 'all') {
            filteredExperiences = [...experiences];
        }
        else {
            filteredExperiences = experiences.filter(exp => exp.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
        }
        // Clear and re-render
        activeCards.forEach(card => recycleCard(card));
        activeCards.clear();
        scrollPosition = 0;
        updateVisibleCards();
    };
    const tagBtns = document.querySelectorAll('.chip');
    tagBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            tagBtns.forEach((b) => b.classList.remove('chip--active'));
            btn.classList.add('chip--active');
            const selectedTag = btn.dataset.tag || 'all';
            applyFilter(selectedTag);
        });
    });
}
// Setup click handlers for carousel cards (no longer needed - handled inline)
export function setupCarouselCardInteractions() {
    // Click handlers are now attached during card creation in updateVisibleCards
}
