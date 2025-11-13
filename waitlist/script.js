/* Live the Gift — Waitlist interactions */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('waitlist-form');
  const emailInput = document.getElementById('email');
  const message = document.getElementById('formMessage');
  const success = document.getElementById('successState');
  const joinBtn = document.getElementById('joinBtn');

  // If previously joined, show success state
  try {
    const joined = JSON.parse(localStorage.getItem('waitlistJoined') || 'null');
    if (joined && joined.email) {
      form?.classList.add('hidden');
      success?.classList.remove('hidden');
    }
  } catch (_) { /* ignore */ }

  const setError = (text) => {
    message.textContent = text;
    message.classList.add('error');
    message.classList.remove('success');
  };
  const setSuccess = (text) => {
    message.textContent = text;
    message.classList.remove('error');
    message.classList.add('success');
  };
  const clearMsg = () => {
    message.textContent = '';
    message.classList.remove('error', 'success');
  };

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).toLowerCase());
  };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg();

    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      emailInput.classList.add('invalid');
      setError('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    emailInput.classList.remove('invalid');
    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';

    // Simulate async submit; replace with your backend later
    await new Promise((r) => setTimeout(r, 900));

    try {
      localStorage.setItem('waitlistJoined', JSON.stringify({ email, at: Date.now() }));
    } catch (_) { /* ignore storage errors */ }

    setSuccess("You're on the waitlist — thank you!");
    form.classList.add('hidden');
    success.classList.remove('hidden');
  });

  emailInput?.addEventListener('input', () => {
    if (emailInput.classList.contains('invalid')) {
      emailInput.classList.remove('invalid');
      clearMsg();
    }
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
      const totalWidth = Array.from(track.children)
        .slice(0, children.length)
        .reduce((acc, el) => acc + el.getBoundingClientRect().width + 16 /* gap */, 0);
      const pixelsPerSecond = 140; // tweak for speed
      const duration = Math.max(28, Math.min(60, totalWidth / pixelsPerSecond));
      track.style.setProperty('--duration', `${duration}s`);
    });
  }

  // Make experience cards clickable (open testing URL)
  const TEST_URL = 'https://www.google.com';
  document.querySelectorAll('.xp-card').forEach((card) => {
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => {
      window.open(TEST_URL, '_blank', 'noopener');
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.open(TEST_URL, '_blank', 'noopener');
      }
    });
  });

  // Swipeable card stack (Tinder-like)
  const stack = document.querySelector('.card-stack');
  if (stack) {
    let hasInteracted = false;
    let wiggleInterval = null;
    let likedExperiences = [];
    const MAX_SELECTIONS = 5;
    const giftBox = document.getElementById('giftBox');
    const selectedCardsContainer = document.getElementById('selectedCards');
    const dragHint = document.getElementById('dragHint');

    const showGiftBox = () => {
      stack.style.display = 'none';
      giftBox.classList.remove('hidden');
      dragHint?.classList.add('hidden');
      
      // Populate mini cards
      likedExperiences.forEach(exp => {
        const mini = document.createElement('div');
        mini.className = 'gift-box__card-mini';
        mini.innerHTML = `<img src="${exp.image}" alt="${exp.title}" />`;
        mini.title = exp.title;
        selectedCardsContainer.appendChild(mini);
      });
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
      topCard.style.removeProperty('--drag-x');
      topCard.style.removeProperty('--drag-y');
      topCard.style.removeProperty('--drag-r');
      const likeLabel = topCard.querySelector('.swipe-label--like');
      const nopeLabel = topCard.querySelector('.swipe-label--nope');
      if (likeLabel) likeLabel.style.opacity = '0';
      if (nopeLabel) nopeLabel.style.opacity = '0';
    };

    const demoTopCardDrag = () => {
      if (hasInteracted || isDemoRunning) return;
      const card = getTopCard();
      if (!card) return;
      isDemoRunning = true;
      // Ensure CSS animation on top card doesn't conflict
      card.classList.remove('card--hint-wiggle');
      void card.offsetWidth;
      const likeLabel = card.querySelector('.swipe-label--like');
      const nopeLabel = card.querySelector('.swipe-label--nope');
      const autoThreshold = 180;
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
            card.style.removeProperty('--drag-x');
            card.style.removeProperty('--drag-y');
            card.style.removeProperty('--drag-r');
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
      const clickTolerance = 5; // px

      const likeLabel = card.querySelector('.swipe-label--like');
      const nopeLabel = card.querySelector('.swipe-label--nope');

      const onPointerMove = (e) => {
        if (!dragging) return;
        dx = e.clientX - startX;
        dy = e.clientY - startY;
        const rot = dx * 0.06;
        card.style.setProperty('--drag-x', dx + 'px');
        card.style.setProperty('--drag-y', dy + 'px');
        card.style.setProperty('--drag-r', rot + 'deg');
        lastMoveTime = performance.now();
        lastX = e.clientX;
        // Feedback labels
        const intensity = Math.min(1, Math.abs(dx) / 120);
        // Auto-advance at 60% threshold with haptic
        const autoThreshold = 180;

        if (dx > 0) {
          if (likeLabel) likeLabel.style.opacity = String(intensity);
          if (nopeLabel) nopeLabel.style.opacity = '0';
        } else {
          if (nopeLabel) nopeLabel.style.opacity = String(intensity);
          if (likeLabel) likeLabel.style.opacity = '0';
        }

        
        if (Math.abs(dx) > autoThreshold && !card.dataset.autoAdvanced) {
          card.dataset.autoAdvanced = 'true';
          // Haptic feedback on mobile
          if (navigator.vibrate) {
            navigator.vibrate(20);
          }
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
          const likeLabel = card.querySelector('.swipe-label--like');
          const nopeLabel = card.querySelector('.swipe-label--nope');
          if (likeLabel) likeLabel.style.opacity = '0';
          if (nopeLabel) nopeLabel.style.opacity = '0';
          card.style.removeProperty('--drag-x');
          card.style.removeProperty('--drag-y');
          card.style.removeProperty('--drag-r');
          dx = dy = 0;
          return;
        }

        // Lower threshold for auto-advance (was 140, now 200)
        const threshold = 200;
        if (Math.abs(dx) > threshold) {
          const dirRight = dx > 0;
          const now = performance.now();
          const elapsed = Math.max(16, now - dragStartTime);
          const speed = Math.abs(dx) / elapsed; // px per ms
          // Palette from card data, else fallback
          const palette = (card.dataset.colors || '').split(',').map(s => s.trim()).filter(Boolean);
          const colors = palette.length ? palette : ['#7c5cff', '#ec4899', '#f59e0b', '#60a5fa', '#10b981', '#f43f5e'];
          
          // Track liked experiences
          if (dirRight && likedExperiences.length < MAX_SELECTIONS) {
            const cardTitle = card.dataset.title || card.querySelector('figcaption')?.textContent || 'Experience';
            const cardImage = card.querySelector('img')?.src || '';
            likedExperiences.push({ title: cardTitle, image: cardImage });
            
            // Haptic feedback on like
            if (navigator.vibrate) {
              navigator.vibrate([30, 50, 30]);
            }
          }

          // Effects: confetti on like, shake on nope
          if (dirRight) {
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              const countNumber = likedExperiences.length;
              fireConfetti(card, { speed, colors, countNumber });
            }
          } else if (nopeLabel) {
            nopeLabel.style.opacity = '1';
            nopeLabel.classList.add('shake-left');
            setTimeout(() => nopeLabel.classList.remove('shake-left'), 220);
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              fireVacuum(card, { speed, colors });
            }
          }
          card.classList.add(dirRight ? 'fly-out-right' : 'fly-out-left');
          // After animation, move card to bottom of stack
          const handleEnd = () => {
            card.removeEventListener('transitionend', handleEnd);
            card.classList.remove('fly-out-right', 'fly-out-left');
            // Reset drag offsets
            card.style.removeProperty('--drag-x');
            card.style.removeProperty('--drag-y');
            card.style.removeProperty('--drag-r');
            card.style.transition = '';
            card.style.zIndex = '';
            delete card.dataset.autoAdvanced;
            resetLabels();

            // Check if we've reached 5 likes
            if (likedExperiences.length >= MAX_SELECTIONS) {
              showGiftBox();
              return;
            }

            // Move to bottom (firstChild) so another card becomes top
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
          card.style.removeProperty('--drag-x');
          card.style.removeProperty('--drag-y');
          card.style.removeProperty('--drag-r');
          delete card.dataset.autoAdvanced;
          resetLabels();
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
        // Stop any running demo so user takes over cleanly
        cancelDemoIfAny();
        pointerId = e.pointerId;
        card.setPointerCapture(pointerId);
        dragging = true;
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
          dragHint?.classList.add('hidden');
        }
      };

      card.addEventListener('pointerdown', onPointerDown);
      card.addEventListener('pointermove', onPointerMove);
      card.addEventListener('pointerup', onPointerUp);
      card.addEventListener('pointercancel', onPointerUp);
      card.addEventListener('lostpointercapture', onPointerUp);

      // Click to open testing URL when not dragging
      card.addEventListener('click', () => {
        if (!dragging) {
          window.open(TEST_URL, '_blank', 'noopener');
        }
      });
    };

    Array.from(stack.children).forEach(attachDrag);

    function fireConfetti(sourceEl, opts = {}) {
      const rect = sourceEl.getBoundingClientRect();
      // Emit from a band along the right side of the card, not a single point
      const bandX1 = rect.left + rect.width * 0.55;
      const bandX2 = rect.left + rect.width * 0.9;
      const bandY1 = rect.top + rect.height * 0.2;
      const bandY2 = rect.top + rect.height * 0.75;
      const baseColors = ['#7c5cff', '#ec4899', '#f59e0b', '#60a5fa', '#10b981', '#f43f5e'];
      const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : baseColors;
      const shapes = ['square', 'circle', 'triangle', 'ribbon'];
      const speed = Math.max(0.3, Math.min(2.5, Number(opts.speed) || 1)); // px/ms clamped
      const intensity = 0.8 + (speed / 2.5) * 1.4; // 0.8..2.2
      const bursts = Math.max(2, Math.min(5, Math.round(2 + intensity)));
      const perBurst = Math.max(8, Math.min(24, Math.round(10 * intensity)));
      const countNumber = opts.countNumber;

      // Add count number as first confetti element if provided
      if (countNumber !== undefined && countNumber !== null) {
        const centerX = (bandX1 + bandX2) / 2;
        const centerY = (bandY1 + bandY2) / 2;
        const num = document.createElement('div');
        num.className = 'confetti-number';
        num.textContent = countNumber;
        const dx = 20 + Math.random() * 60;
        const dy = -(80 + Math.random() * 80);
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

      // Remove single-point pop ring to avoid focal origin
      const makeRing = () => {};

      const emit = () => {
        // No central ring; keep bursts distributed
        if (!emit._ringed) { makeRing(); emit._ringed = true; }
        for (let i = 0; i < perBurst; i++) {
          const isEmoji = Math.random() < 0.15;
          if (isEmoji) {
            const em = document.createElement('div');
            em.className = 'confetti-emoji';
            em.textContent = ['✨','🎉','💖'][Math.floor(Math.random()*3)];
            const spawnX = bandX1 + Math.random() * (bandX2 - bandX1);
            const spawnY = bandY1 + Math.random() * (bandY2 - bandY1);
            const dx = 60 + Math.random() * 180; // bias to the right
            const dy = -(140 + Math.random() * 200);
            em.style.left = spawnX + 'px';
            em.style.top = spawnY + 'px';
            em.style.setProperty('--dx', dx + 'px');
            em.style.setProperty('--dy', dy + 'px');
            em.style.setProperty('--dur', (900 + Math.random()*400) + 'ms');
            em.style.setProperty('--delay', (Math.random()*120|0) + 'ms');
            em.style.setProperty('--emojiSize', (18 + Math.random()*8) + 'px');
            document.body.appendChild(em);
            em.addEventListener('animationend', () => em.remove());
            continue;
          }

          const piece = document.createElement('div');
          piece.className = 'confetti-piece';
          const spawnX = bandX1 + Math.random() * (bandX2 - bandX1);
          const spawnY = bandY1 + Math.random() * (bandY2 - bandY1);
          const dx = 40 + Math.random() * (160 + intensity * 80); // more spread with speed
          const dy = -(140 + Math.random() * (160 + intensity * 80));
          const rot = Math.floor(Math.random() * 720 - 360);
          piece.style.left = spawnX + 'px';
          piece.style.top = spawnY + 'px';
          piece.style.setProperty('--dx', dx + 'px');
          piece.style.setProperty('--dy', dy + 'px');
          piece.style.setProperty('--rot', rot + 'deg');
          piece.style.setProperty('--dur', (700 + Math.random()*500) + 'ms');
          piece.style.setProperty('--delay', (Math.random()*120|0) + 'ms');
          piece.style.setProperty('--scale', (0.9 + Math.random()*0.6).toFixed(2));

          const shape = shapes[(Math.random() * shapes.length) | 0];
          const color = colors[(Math.random() * colors.length) | 0];
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
          document.body.appendChild(piece);
          piece.addEventListener('animationend', () => piece.remove());
        }
      };

      for (let b = 0; b < bursts; b++) {
        setTimeout(emit, b * 90);
      }
    }

    function fireVacuum(sourceEl, opts = {}) {
      const rect = sourceEl.getBoundingClientRect();
      const originX = rect.left + rect.width * 0.28; // toward left side
      const originY = rect.top + rect.height * 0.5;
      const baseColors = ['#7c5cff', '#ec4899', '#f59e0b', '#60a5fa', '#10b981', '#f43f5e'];
      const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : baseColors;
      const speed = Math.max(0.3, Math.min(2.5, Number(opts.speed) || 1));
      const pieces = Math.max(10, Math.min(24, Math.round(14 * (0.7 + speed))));

      for (let i = 0; i < pieces; i++) {
        const startX = originX + 40 + Math.random() * 160; // start to the right
        const startY = originY + (Math.random() * 120 - 60);
        const suck = document.createElement('div');
        suck.className = 'confetti-suck';
        suck.style.left = startX + 'px';
        suck.style.top = startY + 'px';
        suck.style.background = colors[(Math.random()*colors.length)|0];
        suck.style.setProperty('--toX', (originX - startX) + 'px');
        suck.style.setProperty('--toY', (originY - startY) + 'px');
        suck.style.animationDuration = (350 + Math.random()*220) + 'ms';
        suck.style.animationDelay = (Math.random()*100|0) + 'ms';
        document.body.appendChild(suck);
        suck.addEventListener('animationend', () => suck.remove());
      }
    }
  }
});
