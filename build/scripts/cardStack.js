/* Card Stack Module - Tinder-like swipeable card stack */
import { openInNewTab, triggerHaptic, LIKE_EMOJIS, createConfettiParticle, createConfettiEmoji } from '../utils.js';
// Constants
const MAX_SELECTIONS = 5;
const AUTO_DEMO_THRESHOLD = 180; // px, demo drag sweep
const SWIPE_THRESHOLD = 200; // px, commit swipe
const CLICK_TOLERANCE = 5; // px, distinguish drag vs click
const FIFTH_CARD_FADE_MULTIPLIER = 0.5; // Half card width added to auto threshold for full fade
const SUCCESS_CONFETTI_RADIUS = { min: 128, max: 480 };
const SUCCESS_CONFETTI_PARTICLES_PER_BURST = 20;
const SUCCESS_CONFETTI_BURSTS = 4;
// Deprecated: previously rendered all cards. Now virtualization keeps only 3 cards.
export function generateCardStack(_experiences) { return ''; }
// Initialize card stack interactions with virtualized card reuse
export function initializeCardStack(experiences) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stack = document.querySelector('.card-stack');
    if (!stack)
        return;
    // Virtualization state
    const MAX_VISIBLE = 3;
    let nextExpIndex = 0; // index of next experience not yet shown
    const activeCards = []; // bottom -> top
    let hasInteracted = false;
    let wiggleInterval = null;
    let likedExperiences = [];
    const giftBox = document.getElementById('giftBox');
    const selectedCardsContainer = document.getElementById('selectedCards');
    const dragHint = document.getElementById('dragHint');
    let hintDismissed = false;
    // Ensure initial visibility states
    stack.classList.remove('is-hidden');
    if (giftBox) {
        giftBox.classList.remove('is-visible');
        if (!giftBox.classList.contains('hidden')) {
            giftBox.classList.add('hidden');
        }
    }
    // Create card DOM element
    const createCard = () => {
        const card = document.createElement('figure');
        card.className = 'card card--hint-wiggle';
        card.innerHTML = `
      <img src="" alt="" loading="lazy" />
      <div class="swipe-label swipe-label--like" aria-hidden="true">Gift this!</div>
      <div class="swipe-label swipe-label--nope" aria-hidden="true">Not today</div>
      <figcaption></figcaption>
    `;
        const img = card.querySelector('img');
        if (img)
            img.draggable = false;
        return card;
    };
    const updateCardContent = (card, exp) => {
        const img = card.querySelector('img');
        const caption = card.querySelector('figcaption');
        img.src = exp.image;
        img.alt = exp.alt;
        caption.textContent = exp.title;
        card.dataset.title = exp.title;
        card.dataset.url = exp.url;
    };
    const getStackCardsExcept = (excludeCard) => activeCards.filter(c => c !== excludeCard);
    // Helper: Update stack card opacity based on fade progress (0 = opaque, 1 = transparent)
    const updateStackOpacity = (excludeCard, fadeProgress) => {
        const stackCards = getStackCardsExcept(excludeCard);
        stackCards.forEach((c) => {
            c.style.opacity = String(1 - fadeProgress);
        });
    };
    // Helper: Reset stack card opacity to default
    const resetStackOpacity = (excludeCard) => {
        const stackCards = getStackCardsExcept(excludeCard);
        stackCards.forEach((c) => {
            c.style.opacity = '';
        });
    };
    // Helper: Clear drag transform properties from card
    const clearDragTransform = (card) => {
        card.style.removeProperty('--drag-x');
        card.style.removeProperty('--drag-y');
        card.style.removeProperty('--drag-r');
    };
    // Helper: Reset swipe label opacity
    const resetSwipeLabels = (card) => {
        const likeLabel = card.querySelector('.swipe-label--like');
        const nopeLabel = card.querySelector('.swipe-label--nope');
        if (likeLabel)
            likeLabel.style.opacity = '0';
        if (nopeLabel)
            nopeLabel.style.opacity = '0';
    };
    // Top card is last in activeCards
    const getTopCard = () => activeCards[activeCards.length - 1] || null;
    // Random transform helpers (within -4 to +4 px, -3 to +3 deg)
    const randX = () => Math.floor(Math.random() * 9 - 4);
    const randY = () => Math.floor(Math.random() * 9 - 4);
    const randTilt = () => Math.floor(Math.random() * 7 - 3);
    const setRandomBase = (el) => {
        const x = randX();
        const y = randY();
        const r = randTilt();
        el.style.setProperty('--base-x', x + 'px');
        el.style.setProperty('--base-y', y + 'px');
        el.style.setProperty('--base-r', r + 'deg');
    };
    // Initialize first visible cards (virtual rendering)
    const initVirtualCards = () => {
        for (let i = 0; i < Math.min(MAX_VISIBLE, experiences.length); i++) {
            const exp = experiences[nextExpIndex++];
            const card = createCard();
            updateCardContent(card, exp);
            setRandomBase(card);
            stack.appendChild(card); // appended -> becomes higher visually; we'll reorder later if needed
            activeCards.push(card);
        }
    };
    initVirtualCards();
    // Helper: Apply fade effect to stack cards when swiping the fifth card right
    const applyFifthCardFade = (draggedCard, dx) => {
        if (likedExperiences.length !== 4)
            return;
        if (dx <= 0) {
            resetStackOpacity(draggedCard);
            return;
        }
        const cardWidth = draggedCard.getBoundingClientRect().width;
        const fullFadeAt = AUTO_DEMO_THRESHOLD + cardWidth * FIFTH_CARD_FADE_MULTIPLIER;
        const fadeProgress = Math.min(1, Math.max(0, dx / fullFadeAt));
        updateStackOpacity(draggedCard, fadeProgress);
    };
    const showGiftBox = () => {
        if (stack) {
            stack.classList.add('is-hidden');
            // Remove remaining cards after fade to avoid lingering DOM listeners
            window.setTimeout(() => {
                activeCards.splice(0).forEach(node => node.remove());
            }, 400);
        }
        if (giftBox) {
            giftBox.classList.remove('hidden');
            giftBox.classList.add('is-visible');
        }
        // Fade the hint (keep DOM to avoid layout jump)
        dragHint?.classList.add('drag-hint--fade');
        // Stop ambient animations
        stopAllWiggles();
        cancelDemoIfAny();
        if (wiggleInterval) {
            clearInterval(wiggleInterval);
            wiggleInterval = null;
        }
        // Fire confetti celebration when gift box is shown
        if (!prefersReducedMotion && giftBox) {
            fireConfetti(giftBox);
        }
        // Populate mini cards
        if (selectedCardsContainer) {
            likedExperiences.forEach((exp) => {
                const mini = document.createElement('div');
                mini.className = 'gift-box__card-mini';
                mini.innerHTML = `<img src="${exp.image}" alt="${exp.title}" />`;
                mini.title = exp.title;
                mini.style.cursor = 'pointer';
                mini.addEventListener('click', () => openInNewTab(exp.url));
                selectedCardsContainer.appendChild(mini);
            });
        }
        // Move focus for accessibility
        if (giftBox) {
            giftBox.setAttribute('tabindex', '-1');
            giftBox.focus();
        }
    };
    const triggerWiggle = () => {
        if (hasInteracted)
            return;
        activeCards.forEach((card, i) => {
            card.style.setProperty('--wiggle-delay', 1 + i * 0.3 + 's');
            card.classList.remove('card--hint-wiggle');
            void card.offsetWidth; // force reflow
            card.classList.add('card--hint-wiggle');
        });
    };
    const stopAllWiggles = () => {
        activeCards.forEach((card) => {
            card.classList.remove('card--hint-wiggle');
            card.style.animation = 'none';
        });
    };
    // Initial wiggle after 1s
    setTimeout(triggerWiggle, 1000);
    // Top-card deep wiggle to auto-threshold with label visibility
    let isDemoRunning = false;
    let demoRAF = null;
    let tailTimers = [];
    const cancelDemoIfAny = () => {
        if (!isDemoRunning)
            return;
        isDemoRunning = false;
        if (demoRAF)
            cancelAnimationFrame(demoRAF);
        demoRAF = null;
        tailTimers.forEach((id) => clearTimeout(id));
        tailTimers = [];
        const topCard = getTopCard();
        if (!topCard)
            return;
        // Cleanup drag vars and labels
        clearDragTransform(topCard);
        resetSwipeLabels(topCard);
    };
    const demoTopCardDrag = () => {
        if (hasInteracted || isDemoRunning)
            return;
        const card = getTopCard();
        if (!card)
            return;
        // Start demo animation for the current top card
        isDemoRunning = true;
        // Ensure CSS animation on top card doesn't conflict
        card.classList.remove('card--hint-wiggle');
        void card.offsetWidth;
        const likeLabel = card.querySelector('.swipe-label--like');
        const nopeLabel = card.querySelector('.swipe-label--nope');
        const autoThreshold = AUTO_DEMO_THRESHOLD;
        const duration = 2400; // slowed by 50%: full left->right->center
        const start = performance.now();
        const step = (now) => {
            const elapsed = now - start;
            const progress = Math.min(1, elapsed / duration);
            const phase = progress < 0.5 ? progress * 2 : 2 - progress * 2;
            const dx = (phase < 0.5 ? -1 : 1) * (phase < 0.5 ? phase * 2 : 2 - phase * 2) * autoThreshold;
            const dy = -Math.abs(Math.sin(phase * Math.PI)) * 20;
            const rot = dx * 0.06;
            card.style.setProperty('--drag-x', dx + 'px');
            card.style.setProperty('--drag-y', dy + 'px');
            card.style.setProperty('--drag-r', rot + 'deg');
            const intensity = Math.min(1, Math.abs(dx) / 120);
            if (dx > 0) {
                if (likeLabel)
                    likeLabel.style.opacity = String(intensity);
                if (nopeLabel)
                    nopeLabel.style.opacity = '0';
            }
            else {
                if (nopeLabel)
                    nopeLabel.style.opacity = String(intensity);
                if (likeLabel)
                    likeLabel.style.opacity = '0';
            }
            if (progress < 1) {
                demoRAF = requestAnimationFrame(step);
            }
            else {
                clearDragTransform(card);
                resetSwipeLabels(card);
                isDemoRunning = false;
                demoRAF = null;
                const delay = 6000 + Math.random() * 4000;
                const tid = window.setTimeout(demoTopCardDrag, delay);
                tailTimers.push(tid);
            }
        };
        demoRAF = requestAnimationFrame(step);
    };
    // Schedule first demo after wiggle finishes
    setTimeout(() => {
        if (!hasInteracted)
            demoTopCardDrag();
    }, 5400);
    // Periodic wiggle every 12s if user hasn't interacted
    wiggleInterval = window.setInterval(() => {
        if (!hasInteracted)
            triggerWiggle();
    }, 12000);
    const attachDrag = (card) => {
        let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
        const clickTolerance = CLICK_TOLERANCE;
        let moved = false; // exceeded click tolerance
        let blockClickUntil = 0; // suppress click shortly after drag
        const likeLabel = card.querySelector('.swipe-label--like');
        const nopeLabel = card.querySelector('.swipe-label--nope');
        const onPointerMove = (e) => {
            if (!dragging)
                return;
            dx = e.clientX - startX;
            dy = e.clientY - startY;
            if (!moved && (Math.abs(dx) > clickTolerance || Math.abs(dy) > clickTolerance)) {
                moved = true;
            }
            const rot = dx * 0.06;
            card.style.setProperty('--drag-x', dx + 'px');
            card.style.setProperty('--drag-y', dy + 'px');
            card.style.setProperty('--drag-r', rot + 'deg');
            // Feedback labels
            const intensity = Math.min(1, Math.abs(dx) / 120);
            // Auto-advance at 60% threshold with haptic
            const autoThreshold = AUTO_DEMO_THRESHOLD;
            if (dx > 0) {
                if (likeLabel)
                    likeLabel.style.opacity = String(intensity);
                if (nopeLabel)
                    nopeLabel.style.opacity = '0';
            }
            else {
                if (nopeLabel)
                    nopeLabel.style.opacity = String(intensity);
                if (likeLabel)
                    likeLabel.style.opacity = '0';
            }
            // Fade stack cards when dragging the fifth (final) card to the right
            applyFifthCardFade(card, dx);
            if (Math.abs(dx) > autoThreshold && !card.dataset.autoAdvanced) {
                card.dataset.autoAdvanced = 'true';
                // Haptic feedback on mobile
                triggerHaptic(20);
            }
        };
        const resetLabels = () => {
            if (likeLabel)
                likeLabel.style.opacity = '0';
            if (nopeLabel)
                nopeLabel.style.opacity = '0';
        };
        const onPointerUp = () => {
            if (!dragging)
                return;
            card.releasePointerCapture(pointerId);
            dragging = false;
            card.classList.remove('is-dragging');
            // Ensure CSS transitions can run after we disabled them on pointerdown
            card.style.transition = '';
            card.style.zIndex = '';
            // If movement is tiny, treat as click: cleanup only; allow click handler to open link
            if (Math.abs(dx) < clickTolerance && Math.abs(dy) < clickTolerance) {
                delete card.dataset.autoAdvanced;
                resetSwipeLabels(card);
                clearDragTransform(card);
                moved = false;
                dx = dy = 0;
                return;
            }
            // Suppress click after any meaningful drag
            blockClickUntil = Date.now() + 800;
            const dirRight = dx > 0;
            const threshold = SWIPE_THRESHOLD;
            if (Math.abs(dx) >= threshold) {
                // Committed swipe: fly off screen
                card.style.transition = 'transform .373s ease-in, opacity .373s ease-in';
                card.style.zIndex = '99';
                // Save liked experiences
                if (dirRight) {
                    const title = card.dataset.title || '';
                    const url = card.dataset.url || '';
                    const imgEl = card.querySelector('img');
                    const image = imgEl ? imgEl.src : '';
                    likedExperiences.push({ title, image, url });
                    // Show count number
                    if (!prefersReducedMotion) {
                        showCountNumber(likedExperiences.length);
                    }
                    // Confetti at card center (like only)
                    if (!prefersReducedMotion) {
                        const rect = card.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2;
                        const cy = rect.top + rect.height / 2;
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
                    // Shake like label
                    if (likeLabel) {
                        likeLabel.style.opacity = '1';
                        likeLabel.classList.add('shake-right');
                        setTimeout(() => likeLabel.classList.remove('shake-right'), 220);
                    }
                }
                else if (nopeLabel) {
                    nopeLabel.style.opacity = '1';
                    nopeLabel.classList.add('shake-left');
                    setTimeout(() => nopeLabel.classList.remove('shake-left'), 220);
                }
                // Fade out the drag hint on first actual selection
                if (!hintDismissed) {
                    dragHint?.classList.add('drag-hint--fade');
                    hintDismissed = true;
                }
                card.classList.add(dirRight ? 'fly-out-right' : 'fly-out-left');
                // After animation, move card to bottom of stack
                const handleEnd = () => {
                    card.removeEventListener('transitionend', handleEnd);
                    card.classList.remove('fly-out-right', 'fly-out-left');
                    // Reset drag offsets
                    clearDragTransform(card);
                    card.style.transition = '';
                    card.style.zIndex = '';
                    delete card.dataset.autoAdvanced;
                    resetLabels();
                    // Check if we've reached 5 likes
                    if (likedExperiences.length >= MAX_SELECTIONS) {
                        showGiftBox();
                        return;
                    }
                    // Virtual reuse: recycle swiped top card
                    const topIdx = activeCards.indexOf(card);
                    if (topIdx > -1) {
                        activeCards.splice(topIdx, 1); // remove from active list
                    }
                    // If more experiences remain AND not finished selections, repurpose card; else drop it.
                    if (nextExpIndex < experiences.length && likedExperiences.length < MAX_SELECTIONS) {
                        const nextExp = experiences[nextExpIndex++];
                        updateCardContent(card, nextExp);
                        clearDragTransform(card);
                        resetSwipeLabels(card);
                        card.classList.remove('fly-out-right', 'fly-out-left');
                        card.style.transition = '';
                        card.style.zIndex = '';
                        setRandomBase(card);
                        // Insert at bottom (front) so stacking order preserved (bottom first)
                        stack.insertBefore(card, stack.firstChild);
                        activeCards.unshift(card);
                        // Animate remaining (excluding top) lightly
                        const others = activeCards.slice(0, -1);
                        others.forEach(c => c.classList.add('base-animate'));
                        setRandomBase(activeCards[0]);
                        setTimeout(() => others.forEach(c => c.classList.remove('base-animate')), 240);
                    }
                    else {
                        // No more experiences or pack complete: remove the DOM node
                        card.remove();
                    }
                    const others = activeCards.slice(0, -1);
                    // remove animation class after transition
                    setTimeout(() => {
                        others.forEach((c) => c.classList.remove('base-animate'));
                    }, 240);
                    // Add dribbling effect to remaining cards after like only
                    if (dirRight) {
                        setTimeout(() => {
                            if (others.length > 0) {
                                others.forEach((c, idx) => {
                                    const randomDelay = Math.random() * 80;
                                    setTimeout(() => {
                                        c.classList.add('dribble');
                                        setTimeout(() => c.classList.remove('dribble'), 320);
                                    }, idx * 60 + randomDelay); // stagger with random variation
                                });
                            }
                        }, 200);
                    }
                };
                card.addEventListener('transitionend', handleEnd);
            }
            else {
                // Snap back
                card.classList.add('snap-back');
                clearDragTransform(card);
                delete card.dataset.autoAdvanced;
                resetLabels();
                // Reset stack card opacity if it was faded
                resetStackOpacity(card);
                const handleBack = () => {
                    card.classList.remove('snap-back');
                    card.style.transition = '';
                    card.style.zIndex = '';
                    card.removeEventListener('transitionend', handleBack);
                    // Haptic-like bounce
                    card.classList.add('haptic-bounce');
                    setTimeout(() => card.classList.remove('haptic-bounce'), 200);
                };
                card.addEventListener('transitionend', handleBack);
            }
            // reset state
            dx = dy = 0;
        };
        let pointerId = null;
        const onPointerDown = (e) => {
            // Only allow drag on the top card
            if (card !== getTopCard())
                return;
            // Prevent default image/text dragging behavior when starting a swipe
            e.preventDefault();
            // Stop any running demo so user takes over cleanly
            cancelDemoIfAny();
            pointerId = e.pointerId;
            card.setPointerCapture(pointerId);
            dragging = true;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            card.classList.add('is-dragging');
            card.style.transition = 'none';
            card.style.zIndex = '10';
            // Mark as interacted on first drag
            if (!hasInteracted) {
                hasInteracted = true;
                if (wiggleInterval)
                    clearInterval(wiggleInterval);
                stopAllWiggles();
                // Keep hint visible until a real selection is made (no hide here)
            }
        };
        card.addEventListener('pointerdown', onPointerDown);
        card.addEventListener('pointermove', onPointerMove);
        card.addEventListener('pointerup', onPointerUp);
        card.addEventListener('pointercancel', onPointerUp);
        card.addEventListener('lostpointercapture', onPointerUp);
        // Click to open experience URL when not dragging or after a drag
        card.addEventListener('click', (evt) => {
            if (dragging || moved || Date.now() < blockClickUntil) {
                evt.preventDefault();
                evt.stopPropagation();
                return;
            }
            const url = card.dataset.url || 'https://www.google.com';
            openInNewTab(url);
        });
    };
    Array.from(stack.children).forEach((el) => attachDrag(el));
    function showCountNumber(countNumber) {
        // Show just the count number flying up from the card
        const stackRect = stack.getBoundingClientRect();
        const stackCenterX = stackRect.left + stackRect.width / 2;
        const stackCenterY = stackRect.top + stackRect.height / 2;
        const bandWidth = stackRect.width * 0.35;
        const bandHeight = stackRect.height * 0.55;
        const bandX1 = stackCenterX + stackRect.width * 0.05;
        const bandX2 = stackCenterX + bandWidth;
        const bandY1 = stackCenterY - bandHeight / 2;
        const bandY2 = stackCenterY + bandHeight / 2;
        const centerX = (bandX1 + bandX2) / 2;
        const centerY = (bandY1 + bandY2) / 2;
        const num = document.createElement('div');
        num.className = 'confetti-number';
        num.textContent = String(countNumber);
        // Move right and up with the card
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
    // Success confetti: center-screen burst after join
    function fireConfetti(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
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
                }
                else {
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
