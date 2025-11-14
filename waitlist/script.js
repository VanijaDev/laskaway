/* Live the Gift — Waitlist interactions */

document.addEventListener('DOMContentLoaded', () => {
  // Constants and helpers
  const COLORS = ['#7c5cff', '#ec4899', '#f59e0b', '#60a5fa', '#10b981', '#f43f5e'];
  const LIKE_EMOJIS = ['✨','🎉','💖','🥳','💯','🤪','😍','🙌','🥰','🤩','👌'];
  const MAX_SELECTIONS = 5;
  const AUTO_DEMO_THRESHOLD = 180; // px, demo drag sweep
  const SWIPE_THRESHOLD = 200; // px, commit swipe
  const CLICK_TOLERANCE = 5; // px, distinguish drag vs click
  const FIFTH_CARD_FADE_MULTIPLIER = 0.5; // Half card width added to auto threshold for full fade
  const TEST_URL = 'https://www.google.com';
  const SUCCESS_CONFETTI_RADIUS = { min: 128, max: 480 };
  const SUCCESS_CONFETTI_PARTICLES_PER_BURST = 20;
  const SUCCESS_CONFETTI_BURSTS = 4;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const openInNewTab = (url) => window.open(url, '_blank', 'noopener');
  const setAriaInvalid = (el, isInvalid) => {
    if (!el) return;
    if (isInvalid) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  };

  // Shared confetti particle builder
  const createConfettiParticle = (x, y, dx, dy) => {
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
    piece.style.setProperty('--delay', (Math.random() * 120 | 0) + 'ms');
    piece.style.setProperty('--scale', (0.9 + Math.random() * 0.6).toFixed(2));
    
    const shape = shapes[(Math.random() * shapes.length) | 0];
    const color = COLORS[(Math.random() * COLORS.length) | 0];
    if (shape === 'circle') {
      piece.style.borderRadius = '50%';
    } else if (shape === 'triangle') {
      piece.style.width = '0';
      piece.style.height = '0';
      piece.style.borderLeft = '8px solid transparent';
      piece.style.borderRight = '8px solid transparent';
      piece.style.borderBottom = '14px solid ' + color;
    } else if (shape === 'ribbon') {
      piece.style.width = '6px';
      piece.style.height = '18px';
      piece.style.borderRadius = '3px';
      piece.style.background = `linear-gradient(180deg, ${color}, rgba(255,255,255,.9))`;
    }
    if (shape !== 'triangle' && shape !== 'ribbon') {
      piece.style.background = color;
      if (Math.random() > 0.6) piece.style.width = piece.style.height = '10px';
    }
    return piece;
  };

  const createConfettiEmoji = (x, y, dx, dy, emojiSet) => {
    const em = document.createElement('div');
    em.className = 'confetti-emoji';
    em.textContent = emojiSet[(Math.random() * emojiSet.length) | 0];
    em.style.left = x + 'px';
    em.style.top = y + 'px';
    em.style.setProperty('--dx', dx + 'px');
    em.style.setProperty('--dy', dy + 'px');
    em.style.setProperty('--dur', (1800 + Math.random() * 800) + 'ms');
    em.style.setProperty('--delay', (Math.random() * 120 | 0) + 'ms');
    em.style.setProperty('--emojiSize', (18 + Math.random() * 8) + 'px');
    return em;
  };

  const form = document.getElementById('waitlist-form');
  const emailInput = document.getElementById('email');
  const waitlistJoinSuccess = document.getElementById('successState');
  const joinBtn = document.getElementById('joinBtn');

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).toLowerCase());

  // Real-time email validation: persistent states
  emailInput?.addEventListener('input', () => {
    const value = emailInput.value.trim();
    if (value.length === 0) {
      emailInput.classList.remove('valid', 'invalid');
      setAriaInvalid(emailInput, false);
    } else if (isValidEmail(value)) {
      emailInput.classList.add('valid');
      emailInput.classList.remove('invalid');
      setAriaInvalid(emailInput, false);
    } else {
      emailInput.classList.add('invalid');
      emailInput.classList.remove('valid');
      setAriaInvalid(emailInput, true);
    }
    // Update hover-disabled visual state when the user types
    refreshJoinHoverState && refreshJoinHoverState();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      emailInput.classList.add('invalid');
      emailInput.classList.remove('valid');
      setAriaInvalid(emailInput, true);
      emailInput.focus();
      return;
    }

    emailInput.classList.remove('invalid', 'valid');
    setAriaInvalid(emailInput, false);
    // Disable input while submitting to prevent changes and duplicate actions
    emailInput.disabled = true;
    joinBtn.disabled = true;
    joinBtn.classList.add('submitting');
    joinBtn.textContent = 'Joining…';

    // Simulate async submit; replace with your backend later
    await new Promise((r) => setTimeout(r, 900));

    // No persistence: do not write to localStorage
    form.classList.add('hidden');
    waitlistJoinSuccess.classList.remove('hidden');
    
    // Celebration confetti on successful join
    if (!prefersReducedMotion) {
      fireConfetti(waitlistJoinSuccess);
    }
  });

  // Make the submit button appear disabled on hover when email is invalid
  let isHoveringJoin = false;
  function refreshJoinHoverState() {
    if (!joinBtn) return;
    if (joinBtn.classList.contains('submitting')) return; // keep disabled during submit
    if (emailInput?.disabled) return; // skip when input is disabled during submit
    const valid = isValidEmail(emailInput?.value.trim() || '');
    if (isHoveringJoin && !valid) {
      joinBtn.disabled = true;
      joinBtn.dataset.hoverDisabled = '1';
    } else if (joinBtn.dataset.hoverDisabled === '1') {
      // Re-enable only if we disabled due to hover
      joinBtn.disabled = false;
      delete joinBtn.dataset.hoverDisabled;
    }
  }

  joinBtn?.addEventListener('mouseenter', () => {
    isHoveringJoin = true;
    refreshJoinHoverState();
  });
  joinBtn?.addEventListener('mouseleave', () => {
    isHoveringJoin = false;
    refreshJoinHoverState();
  });

  // Experiences scroller: duplicate content for seamless loop and set animation duration
  const track = document.querySelector('.scroller__track');
  const scroller = document.querySelector('.scroller');
  if (track && scroller) {
    const children = Array.from(track.children);
    // Duplicate once for 50% translateX end
    children.forEach((node) => track.appendChild(node.cloneNode(true)));

    // Calculate duration relative to total width for consistent speed
    requestAnimationFrame(() => {
      const GAP = 32; // match CSS scroller__track gap
      const totalWidth = Array.from(track.children)
        .slice(0, children.length)
        .reduce((acc, el) => acc + el.getBoundingClientRect().width + GAP /* gap */, 0);
      const pixelsPerSecond = 140; // tweak for speed
      const duration = Math.max(28, Math.min(60, totalWidth / pixelsPerSecond));
      track.style.setProperty('--duration', `${duration}s`);
    });
  }

  // Disable native image dragging on stack and carousel images
  const disableNativeImageDrag = () => {
    document.querySelectorAll('.card img, .xp-card img').forEach((img) => {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', (e) => e.preventDefault());
    });
  };
  disableNativeImageDrag();

  // Make experience cards clickable (open testing URL)
  // Experience card interactions
  document.querySelectorAll('.xp-card').forEach((card) => {
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => openInNewTab(TEST_URL));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openInNewTab(TEST_URL);
      }
    });
  });

  // Swipeable card stack (Tinder-like)
  const stack = document.querySelector('.card-stack');
  if (stack) {
    let hasInteracted = false;
    let wiggleInterval = null;
    let likedExperiences = [];
    const giftBox = document.getElementById('giftBox');
    const selectedCardsContainer = document.getElementById('selectedCards');
    const dragHint = document.getElementById('dragHint');
    let hintDismissed = false;

    // Helper: Get all stack cards except the specified one
    const getStackCardsExcept = (excludeCard) => {
      return Array.from(stack.children).filter(c => c !== excludeCard);
    };

    // Helper: Update stack card opacity based on fade progress (0 = opaque, 1 = transparent)
    const updateStackOpacity = (excludeCard, fadeProgress) => {
      const stackCards = getStackCardsExcept(excludeCard);
      stackCards.forEach(c => {
        c.style.opacity = String(1 - fadeProgress);
      });
    };

    // Helper: Reset stack card opacity to default
    const resetStackOpacity = (excludeCard) => {
      const stackCards = getStackCardsExcept(excludeCard);
      stackCards.forEach(c => {
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
      if (likeLabel) likeLabel.style.opacity = '0';
      if (nopeLabel) nopeLabel.style.opacity = '0';
    };

    // Helper: Trigger haptic feedback if available
    const triggerHaptic = (pattern) => {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    };

    // Helper: Apply fade effect to stack when dragging the fifth (final) card
    const applyFifthCardFade = (card, dx) => {
      if (likedExperiences.length === 4 && dx > 0) {
        const cardRect = card.getBoundingClientRect();
        const cardWidth = cardRect.width;
        const fadeThreshold = AUTO_DEMO_THRESHOLD + (cardWidth * FIFTH_CARD_FADE_MULTIPLIER);
        const fadeProgress = Math.min(1, Math.max(0, dx / fadeThreshold));
        updateStackOpacity(card, fadeProgress);
      }
    };

    const showGiftBox = () => {
      cancelDemoIfAny();
      if (wiggleInterval) clearInterval(wiggleInterval);
      stack.style.display = 'none';
      giftBox.classList.remove('hidden');
      // Fade the hint (keep DOM to avoid layout jump)
      dragHint?.classList.add('drag-hint--fade');
      
      // Fire confetti celebration when gift box is shown
      if (!prefersReducedMotion) {
        fireConfetti(giftBox);
      }
      
      // Populate mini cards
      likedExperiences.forEach(exp => {
        const mini = document.createElement('div');
        mini.className = 'gift-box__card-mini';
        mini.innerHTML = `<img src="${exp.image}" alt="${exp.title}" />`;
        mini.title = exp.title;
        mini.style.cursor = 'pointer';
        mini.addEventListener('click', () => openInNewTab(TEST_URL));
        selectedCardsContainer.appendChild(mini);
      });
      // Move focus for accessibility
      giftBox.setAttribute('tabindex', '-1');
      giftBox.focus();
    };

    const triggerWiggle = () => {
      if (hasInteracted) return;
      const cards = Array.from(stack.children);
      cards.forEach((card, i) => {
        card.style.setProperty('--wiggle-delay', (1 + i * 0.3) + 's');
        card.classList.remove('card--hint-wiggle');
        void card.offsetWidth; // force reflow
        card.classList.add('card--hint-wiggle');
      });
    };

    const stopAllWiggles = () => {
      const cards = Array.from(stack.children);
      cards.forEach(card => {
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
      if (!isDemoRunning) return;
      isDemoRunning = false;
      if (demoRAF) cancelAnimationFrame(demoRAF);
      demoRAF = null;
      tailTimers.forEach((id) => clearTimeout(id));
      tailTimers = [];
      const topCard = getTopCard();
      if (!topCard) return;
      // Cleanup drag vars and labels
      clearDragTransform(topCard);
      resetSwipeLabels(topCard);
    };

    const demoTopCardDrag = () => {
      if (hasInteracted || isDemoRunning) return;
      const card = getTopCard();
      if (!card) return;
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
        if (!isDemoRunning || hasInteracted) { cancelDemoIfAny(); return; }
        const t = Math.min(1, (now - start) / duration);
        let dx = 0;
        if (t < 0.3) {
          const tt = t / 0.3;               // 0..1
          dx = -autoThreshold * 0.5 * tt;   // 0 -> -90
        } else if (t < 0.7) {
          const tt = (t - 0.3) / 0.4;       // 0..1
          dx = -autoThreshold * 0.5 + (autoThreshold * 1.5) * tt; // -90 -> +180
        } else {
          const tt = (t - 0.7) / 0.3;       // 0..1
          // ease-out cubic for smoother finish
          const ease = 1 - Math.pow(1 - tt, 3);
          dx = autoThreshold * (1 - ease);  // +180 -> 0 with easing
        }

        const rot = dx * 0.06;
        card.style.setProperty('--drag-x', dx + 'px');
        card.style.setProperty('--drag-y', '0px');
        card.style.setProperty('--drag-r', rot + 'deg');
        const intensity = Math.min(1, Math.abs(dx) / 120);
        if (dx >= 0) {
          if (likeLabel) likeLabel.style.opacity = String(intensity);
          if (nopeLabel) nopeLabel.style.opacity = '0';
        } else {
          if (nopeLabel) nopeLabel.style.opacity = String(intensity);
          if (likeLabel) likeLabel.style.opacity = '0';
        }

        if (t >= 1) {
          // Gentle settle tail using small damped steps, leveraging CSS transform transition
          const tail = [
            { dx: -16, dt: 140 },
            { dx: 8,   dt: 120 },
            { dx: -4,  dt: 100 },
            { dx: 0,   dt: 180 },
          ];
          let acc = 0;
          // fade labels out over the tail
          if (likeLabel) likeLabel.style.opacity = '0';
          if (nopeLabel) nopeLabel.style.opacity = '0';
          tail.forEach(seg => {
            const id = setTimeout(() => {
              const r = seg.dx * 0.06;
              card.style.setProperty('--drag-x', seg.dx + 'px');
              card.style.setProperty('--drag-r', r + 'deg');
            }, acc);
            tailTimers.push(id);
            acc += seg.dt;
          });
          const finalId = setTimeout(() => {
            // Cleanup
            clearDragTransform(card);
            isDemoRunning = false;
            demoRAF = null;
            tailTimers = [];
          }, acc + 20);
          tailTimers.push(finalId);
          return;
        }
        demoRAF = requestAnimationFrame(step);
      };
      demoRAF = requestAnimationFrame(step);
    };

    // Repeat every 10s until first interaction
    wiggleInterval = setInterval(() => {
      if (!hasInteracted) {
        triggerWiggle();
        // Nudge the top card strongly, but avoid overlapping demos
        setTimeout(() => demoTopCardDrag(), 300);
      } else {
        clearInterval(wiggleInterval);
      }
    }, 10000);

    // Kick the first top-card demo shortly after the initial wiggle
    setTimeout(() => demoTopCardDrag(), 1300);
    const getTopCard = () => stack.lastElementChild;

    const randTilt = () => (Math.random() * 16 - 8); // -8..8 deg
    const randX = () => (Math.random() * 36 - 18);   // -18..18 px
    const randY = () => (Math.random() * 28 - 14);   // -14..14 px

    const setRandomBase = (el) => {
      const x = randX();
      const y = randY();
      const r = randTilt();
      el.style.setProperty('--base-x', x + 'px');
      el.style.setProperty('--base-y', y + 'px');
      el.style.setProperty('--base-r', r + 'deg');
    };

    const initializeBases = () => {
      const children = Array.from(stack.children);
      children.forEach((el) => setRandomBase(el));
    };

    // Keep only the top 3 cards visible; others hidden
    const applyVisibility = () => {
      const children = Array.from(stack.children);
      const toHide = children.slice(0, Math.max(0, children.length - 3));
      const toShow = children.slice(-3);
      toHide.forEach((el) => el.classList.add('card--invisible'));
      toShow.forEach((el) => el.classList.remove('card--invisible'));
    };

    const updateStackBases = (randomizeBottom = false) => {
      if (!randomizeBottom) return;
      const children = Array.from(stack.children);
      if (children[0]) setRandomBase(children[0]); // randomize new bottom after a swipe
    };

    // Initialize base transforms randomly for all cards
    initializeBases();
    // Ensure only 3 cards are visible initially
    applyVisibility();

    const attachDrag = (card) => {
      let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
      let dragStartTime = 0, lastMoveTime = 0, lastX = 0;
      const clickTolerance = CLICK_TOLERANCE;
      let moved = false; // exceeded click tolerance
      let blockClickUntil = 0; // suppress click shortly after drag

      const likeLabel = card.querySelector('.swipe-label--like');
      const nopeLabel = card.querySelector('.swipe-label--nope');

      const onPointerMove = (e) => {
        if (!dragging) return;
        dx = e.clientX - startX;
        dy = e.clientY - startY;
        if (!moved && (Math.abs(dx) > clickTolerance || Math.abs(dy) > clickTolerance)) {
          moved = true;
        }
        const rot = dx * 0.06;
        card.style.setProperty('--drag-x', dx + 'px');
        card.style.setProperty('--drag-y', dy + 'px');
        card.style.setProperty('--drag-r', rot + 'deg');
        lastMoveTime = performance.now();
        lastX = e.clientX;
        // Feedback labels
        const intensity = Math.min(1, Math.abs(dx) / 120);
        // Auto-advance at 60% threshold with haptic
        const autoThreshold = AUTO_DEMO_THRESHOLD;

        if (dx > 0) {
          if (likeLabel) likeLabel.style.opacity = String(intensity);
          if (nopeLabel) nopeLabel.style.opacity = '0';
        } else {
          if (nopeLabel) nopeLabel.style.opacity = String(intensity);
          if (likeLabel) likeLabel.style.opacity = '0';
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
        if (likeLabel) likeLabel.style.opacity = '0';
        if (nopeLabel) nopeLabel.style.opacity = '0';
      };

      const onPointerUp = () => {
        if (!dragging) return;
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

        // Lower threshold for auto-advance (was 140, now 200)
        const threshold = SWIPE_THRESHOLD;
        if (Math.abs(dx) > threshold) {
          const dirRight = dx > 0;
          const now = performance.now();
          const elapsed = Math.max(16, now - dragStartTime);
          const speed = Math.abs(dx) / elapsed; // px per ms
          // Palette from card data, else fallback
          const palette = (card.dataset.colors || '').split(',').map(s => s.trim()).filter(Boolean);
          const colors = palette.length ? palette : COLORS;
          
          // Track liked experiences
          if (dirRight && likedExperiences.length < MAX_SELECTIONS) {
            const cardTitle = card.dataset.title || card.querySelector('figcaption')?.textContent || 'Experience';
            const cardImage = card.querySelector('img')?.src || '';
            likedExperiences.push({ title: cardTitle, image: cardImage });
            
            // Haptic feedback on like
            triggerHaptic([30, 50, 30]);
          }

          // Effects: show count number on like, shake on nope
          if (dirRight) {
            // Show count number without confetti
            const countNumber = likedExperiences.length;
            showCountNumber(card, countNumber);
          } else if (nopeLabel) {
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

            // Move to bottom (firstChild) so another card becomes top (only if not at max)
            stack.insertBefore(card, stack.firstElementChild);
            // Re-apply visibility so only 3 cards are shown
            applyVisibility();
            // Smoothly promote visible cards and randomize new bottom tilt
            const visibleChildren = Array.from(stack.children).filter(c => !c.classList.contains('card--invisible'));
            const others = visibleChildren.slice(0, -1); // all visible except the top
            others.forEach((c) => c.classList.add('base-animate'));
            updateStackBases(true);
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
        } else {
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
        if (card !== getTopCard()) return;
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
        dragStartTime = performance.now();
        lastMoveTime = dragStartTime;
        lastX = startX;
        card.classList.add('is-dragging');
        card.style.transition = 'none';
        card.style.zIndex = '10';
        // Mark as interacted on first drag
        if (!hasInteracted) {
          hasInteracted = true;
          if (wiggleInterval) clearInterval(wiggleInterval);
          stopAllWiggles();
          // Keep hint visible until a real selection is made (no hide here)
        }
      };

      card.addEventListener('pointerdown', onPointerDown);
      card.addEventListener('pointermove', onPointerMove);
      card.addEventListener('pointerup', onPointerUp);
      card.addEventListener('pointercancel', onPointerUp);
      card.addEventListener('lostpointercapture', onPointerUp);

      // Click to open testing URL when not dragging or after a drag
      card.addEventListener('click', (evt) => {
        if (dragging || moved || Date.now() < blockClickUntil) {
          evt.preventDefault();
          evt.stopPropagation();
          return;
        }
        openInNewTab(TEST_URL);
      });
    };

    Array.from(stack.children).forEach(attachDrag);

    function showCountNumber(sourceEl, countNumber) {
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
      num.textContent = countNumber;
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

  // Easter egg: Random effect on brand logo click
  const brandLogo = document.getElementById('brandLogo');
  if (brandLogo) {
    // Easter egg constants
    const EASTER_EGG_DURATIONS = {
      RAINBOW_WAVE: 4000,
      CARD_ANIMATION: 2400,
      GENTLE_SWAY: 3000,
      WIND_GUST: 2400
    };
    
    const EASTER_EGG_DELAYS = {
      STACK_CARD_STAGGER: 80,
      CAROUSEL_CARD_STAGGER_DANCE: 100,
      CAROUSEL_CARD_STAGGER_TUMBLE: 120
    };

    // Shared helper: Toggle page-level class with auto-cleanup
    const togglePageClass = (className, duration) => {
      const page = document.querySelector('.page');
      if (!page) return;
      page.classList.add(className);
      setTimeout(() => page.classList.remove(className), duration);
    };

    // Shared helper: Animate cards with a specific class and animation
    const animateCards = (animationClass, animationDuration, animationName, stackDelay, carouselDelay) => {
      const stackCards = document.querySelectorAll('.card-stack .card');
      const carouselCards = document.querySelectorAll('.xp-card');
      
      // Animate swipeable stack cards
      stackCards.forEach((card, idx) => {
        setTimeout(() => {
          card.classList.add(animationClass);
          setTimeout(() => card.classList.remove(animationClass), animationDuration);
        }, idx * stackDelay);
      });
      
      // Animate carousel cards
      carouselCards.forEach((card, idx) => {
        setTimeout(() => {
          card.style.animation = 'none';
          card.offsetHeight; // Force reflow
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
      triggerWindGust
    ];

    const triggerRandomEasterEgg = () => {
      const randomEffect = easterEggEffects[Math.floor(Math.random() * easterEggEffects.length)];
      randomEffect();
    };

    brandLogo.addEventListener('click', triggerRandomEasterEgg);
    brandLogo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerRandomEasterEgg();
      }
    });
  }
});
