/* ============================================
   Laskaway UI - JavaScript
   Experience Gift Service
   ============================================ */

// Experiences are loaded from ../data/experiences.json (shared with the main site)
const EXPERIENCES_ENDPOINT = '../data/experiences.json';
let experiences = [];

const HEART_SVG = `
  <svg class="fav-toggle__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M20.84 4.61c-1.54-1.34-3.77-1.28-5.24.14L12 8.09 8.4 4.75C6.93 3.33 4.7 3.27 3.16 4.61c-1.77 1.54-1.86 4.24-.27 5.89L12 21.35l9.11-10.85c1.59-1.65 1.5-4.35-.27-5.89Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;

const POP_CONFETTI_COLORS = ['#7c5cff', '#ec4899', '#10b981', '#f59e0b'];
const CELEBRATION_CONFETTI_COLORS = ['#7c5cff', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeExperienceImagePath(image) {
  if (!image) return '';
  const value = String(image).trim();
  // data/experiences.json paths are relative to repo root; ui_design lives one level deeper.
  if (value.startsWith('./')) return `../${value.slice(2)}`;
  return value;
}

function deriveExperienceCategory(tags) {
  const list = Array.isArray(tags) ? tags.map((t) => String(t).trim().toLowerCase()) : [];
  if (list.includes('wellness and spa')) return 'wellness and spa';
  if (list.includes('food')) return 'food';
  if (list.includes('adventure') || list.includes('thrill') || list.includes('weekend getaway')) return 'adventure';
  return 'culture';
}

function normalizeUiExperience(raw, index) {
  const id = raw?.id != null ? String(raw.id) : String(index);
  const title = String(raw?.title || '').trim();
  const tags = Array.isArray(raw?.tags) ? raw.tags : [];
  const category = String(raw?.category || deriveExperienceCategory(tags));

  const priceNumber = Number(raw?.price);
  const price = Number.isFinite(priceNumber) ? priceNumber : 99;

  const ratingNumber = Number(raw?.rating);
  const rating = Number.isFinite(ratingNumber) ? ratingNumber : 4.9;

  const duration = String(raw?.duration || '').trim() || '1-2 hours';
  const description = String(raw?.description || '').trim() || `A great local experience: ${title}.`;
  const image = normalizeExperienceImagePath(raw?.image);

  return {
    id,
    title,
    category,
    price,
    duration,
    rating,
    description,
    image,
  };
}

async function loadExperiences() {
  const fallback = (typeof window !== 'undefined' && Array.isArray(window.__LASKAWAY_EXPERIENCES__))
    ? window.__LASKAWAY_EXPERIENCES__
    : null;

  const applyRaw = (raw) => {
    experiences = Array.isArray(raw) ? raw.map(normalizeUiExperience) : [];
  };

  // When opening ui_design via file://, browsers block fetch() for local files.
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    if (fallback) {
      applyRaw(fallback);
      return;
    }
    experiences = [];
    console.error('Experiences unavailable in file:// mode: missing ui_design/experiences.fallback.js');
    return;
  }

  try {
    const response = await fetch(EXPERIENCES_ENDPOINT);
    if (!response.ok) throw new Error(`Failed to fetch experiences from ${EXPERIENCES_ENDPOINT}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Experiences payload is not an array');
    applyRaw(data);
  } catch (error) {
    console.error('Experiences data loading error (ui_design):', error);
    if (fallback) {
      applyRaw(fallback);
      return;
    }
    experiences = [];
  }
}

function formatCategoryLabel(category) {
  if (!category) return '';
  if (category === 'wellness and spa') return 'Wellness & Spa';
  return category
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

function categoryToClass(category) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

// State
let selectedExperiences = [];
let currentFilter = 'all';
let experiencesExpanded = false;
let experiencesPage = 1;
let builderExpanded = false;
let builderPage = 1;
let builderMainLockedMinHeight = null;
let builderHeightLockRaf = null;
const MAX_SELECTIONS = 5;
const BACKGROUND_CONFETTI_COUNT = 50;

// DOM Elements
const experienceGrid = document.getElementById('experienceGrid');
const builderGrid = document.getElementById('builderGrid');
const packItems = document.getElementById('packItems');
const packCount = document.getElementById('packCount');
const sendGiftBtn = document.getElementById('sendGiftBtn');
const recipientName = document.getElementById('recipientName');
const giftMessage = document.getElementById('giftMessage');
const searchInput = document.getElementById('searchExperiences');
const successModal = document.getElementById('successModal');
const recipientDisplay = document.getElementById('recipientDisplay');
const closeModalBtn = document.getElementById('closeModal');
const categoryTabs = document.querySelectorAll('.tab');
const favsBtn = document.getElementById('favsBtn');
const favsCount = document.getElementById('favsCount');
const favsPanel = document.getElementById('favsPanel');
const favsList = document.getElementById('favsList');
const favsCloseBtn = document.getElementById('favsCloseBtn');
const expSeeMoreBtn = document.getElementById('expSeeMoreBtn');
const expPagination = document.getElementById('expPagination');
const builderSeeMoreBtn = document.getElementById('builderSeeMoreBtn');
const builderPagination = document.getElementById('builderPagination');
const builderMain = builderGrid?.closest('.builder__main') || document.querySelector('.builder__main');

const FAV_STORAGE_KEY = 'laskaway_favourites';
let favouriteIds = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  loadFavourites();
  await loadExperiences();
  renderExperienceShowcase();
  renderBuilderGrid();
  setupEventListeners();
  setupHeaderCreateGiftVisibility();
  setupFavourites();
  createConfetti();
});

// Experiences (pagination + expansion)

function getGridColumnCount(gridEl) {
  if (!gridEl) return 1;
  const value = window.getComputedStyle(gridEl).gridTemplateColumns;
  const count = value
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean).length;
  return Math.max(1, count || 1);
}

function getExperienceRowsVisible() {
  return experiencesExpanded ? 4 : 1;
}

function getExperiencePageSize() {
  const columns = getGridColumnCount(experienceGrid);
  return Math.max(1, columns * getExperienceRowsVisible());
}

function getBuilderPageSize() {
  // Builder default should show a fixed count (9) regardless of responsive columns.
  if (!builderExpanded) return 9;
  const columns = getGridColumnCount(builderGrid);
  return Math.max(1, columns * 4);
}

function renderBuilderPagination(totalPages) {
  if (!builderPagination) return;

  // Pagination should only appear after user expands the grid via "See more".
  if (!builderExpanded || totalPages <= 1) {
    builderPagination.classList.add('is-hidden');
    builderPagination.innerHTML = '';
    return;
  }

  builderPagination.classList.remove('is-hidden');
  builderPagination.innerHTML = Array.from({ length: totalPages })
    .map((_, index) => {
      const page = index + 1;
      const isActive = page === builderPage;
      return `
        <button class="builder-page ${isActive ? 'builder-page--active' : ''}" type="button" data-builder-page="${page}" ${isActive ? 'aria-current="page"' : ''}>
          ${page}
        </button>
      `;
    })
    .join('');
}

function syncBuilderFooterVisibility(totalItems) {
  if (!builderSeeMoreBtn) return;

  if (builderExpanded) {
    builderSeeMoreBtn.classList.add('is-hidden');
    return;
  }

  const canShowMore = totalItems > 9;
  builderSeeMoreBtn.classList.toggle('is-hidden', !canShowMore);
}

function clearBuilderHeightLock() {
  builderMainLockedMinHeight = null;
  if (builderHeightLockRaf) cancelAnimationFrame(builderHeightLockRaf);
  builderHeightLockRaf = null;
  if (builderMain instanceof HTMLElement) builderMain.style.minHeight = '';
}

function scheduleBuilderHeightLock() {
  if (!(builderMain instanceof HTMLElement)) return;

  if (!builderExpanded) {
    clearBuilderHeightLock();
    return;
  }

  if (typeof builderMainLockedMinHeight === 'number') {
    builderMain.style.minHeight = `${builderMainLockedMinHeight}px`;
    return;
  }

  if (builderHeightLockRaf) cancelAnimationFrame(builderHeightLockRaf);
  builderHeightLockRaf = requestAnimationFrame(() => {
    // Measure after layout settles (post render) and lock the expanded height.
    const measured = Math.ceil(builderMain.getBoundingClientRect().height);
    if (measured > 0) {
      builderMainLockedMinHeight = measured;
      builderMain.style.minHeight = `${builderMainLockedMinHeight}px`;
    }
    builderHeightLockRaf = null;
  });
}

function renderExperiencePagination(totalPages) {
  if (!expPagination) return;

  // Pagination should only appear after user expands the grid via "See more".
  if (!experiencesExpanded) {
    expPagination.classList.add('is-hidden');
    expPagination.innerHTML = '';
    return;
  }

  if (totalPages <= 1) {
    expPagination.classList.add('is-hidden');
    expPagination.innerHTML = '';
    return;
  }

  expPagination.classList.remove('is-hidden');
  expPagination.innerHTML = Array.from({ length: totalPages })
    .map((_, index) => {
      const page = index + 1;
      const isActive = page === experiencesPage;
      return `
        <button class="exp-page ${isActive ? 'exp-page--active' : ''}" type="button" data-exp-page="${page}" ${isActive ? 'aria-current="page"' : ''}>
          ${page}
        </button>
      `;
    })
    .join('');
}

function syncExperienceFooterVisibility(totalItems) {
  if (!expSeeMoreBtn) return;

  if (experiencesExpanded) {
    expSeeMoreBtn.classList.add('is-hidden');
    return;
  }

  const columns = getGridColumnCount(experienceGrid);
  const canShowMoreRows = totalItems > columns;
  expSeeMoreBtn.classList.toggle('is-hidden', !canShowMoreRows);
}

function getSearchQuery() {
  return (searchInput?.value || '').trim();
}

function renderFavToggle(expId) {
  const isFav = favouriteIds.has(expId);
  return `
    <button class="fav-toggle ${isFav ? 'fav-toggle--active' : ''}" type="button" data-fav-toggle="true" data-id="${expId}" aria-pressed="${isFav ? 'true' : 'false'}" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}">
      <span class="fav-toggle__inner" aria-hidden="true">${HEART_SVG}</span>
    </button>
  `;
}

function renderExperienceCard(exp) {
  return `
    <article class="exp-card" data-id="${exp.id}">
      <div class="exp-card__image">
        <img src="${exp.image}" alt="${exp.title}" loading="lazy" />
        ${renderFavToggle(exp.id)}
      </div>
      <div class="exp-card__content">
        <div class="exp-card__top">
          <span class="exp-card__tag exp-card__tag--${categoryToClass(exp.category)}">${formatCategoryLabel(exp.category)}</span>
          <div class="exp-card__rating" aria-label="Rating">
            <span class="exp-card__rating-star" aria-hidden="true">★</span>
            <span class="exp-card__rating-value">${Number.isFinite(exp.rating) ? exp.rating.toFixed(1) : '4.9'}</span>
          </div>
        </div>
        <h3 class="exp-card__title">${exp.title}</h3>
        <p class="exp-card__desc">${exp.description || ''}</p>
        <div class="exp-card__bottom">
          <div class="exp-card__price">$${exp.price}</div>
          <button class="exp-card__book" type="button">Book Now</button>
        </div>
      </div>
    </article>
  `;
}

function renderBuilderCard(exp) {
  const isSelected = selectedExperiences.some((e) => e.id === exp.id);
  const isDisabled = !isSelected && selectedExperiences.length >= MAX_SELECTIONS;
  return `
    <article class="builder-card ${isSelected ? 'builder-card--selected' : ''} ${isDisabled ? 'builder-card--disabled' : ''}" data-id="${exp.id}">
      <div class="builder-card__image">
        <img src="${exp.image}" alt="${exp.title}" loading="lazy" />
        ${renderFavToggle(exp.id)}
      </div>
      <div class="builder-card__content">
        <div class="builder-card__top">
          <span class="exp-card__tag exp-card__tag--${categoryToClass(exp.category)}">${formatCategoryLabel(exp.category)}</span>
          <div class="builder-card__rating" aria-label="Rating">
            <span class="builder-card__rating-star" aria-hidden="true">★</span>
            <span class="builder-card__rating-value">${Number.isFinite(exp.rating) ? exp.rating.toFixed(1) : '4.9'}</span>
          </div>
        </div>
        <h4 class="builder-card__title">${exp.title}</h4>
        <p class="builder-card__desc">${exp.description || ''}</p>
        <div class="builder-card__bottom">
          <div class="builder-card__price">$${exp.price}</div>
          <button class="builder-card__book" type="button">Book Now</button>
        </div>
      </div>
      <div class="builder-card__check">✓</div>
    </article>
  `;
}

function loadFavourites() {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      favouriteIds = new Set(
        parsed
          .map((v) => (v == null ? '' : String(v)))
          .map((v) => v.trim())
          .filter(Boolean)
      );
    }
  } catch {
    favouriteIds = new Set();
  }
}

function saveFavourites() {
  localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(favouriteIds)));
}

function updateFavouritesCounter() {
  if (!favsCount) return;
  const count = favouriteIds.size;
  favsCount.textContent = String(count);
  favsCount.classList.toggle('is-hidden', count === 0);
}

function renderFavouritesPanel() {
  if (!favsList) return;

  if (favouriteIds.size === 0) {
    favsList.innerHTML = '<div class="favs-empty">No favourites yet. Tap the heart on an experience to save it here.</div>';
    return;
  }

  const items = Array.from(favouriteIds)
    .map((id) => experiences.find((e) => e.id === id))
    .filter(Boolean);

  favsList.innerHTML = items
    .map((exp) => `
      <div class="favs-item">
        <img class="favs-item__img" src="${exp.image}" alt="${exp.title}" loading="lazy" />
        <div class="favs-item__title">${exp.title}</div>
        <button class="favs-item__remove" type="button" data-fav-toggle="true" data-id="${exp.id}" aria-label="Remove from favourites">✕</button>
      </div>
    `)
    .join('');
}

function setFavouritesPanelOpen(isOpen) {
  if (!favsPanel || !favsBtn) return;
  favsPanel.classList.toggle('is-hidden', !isOpen);
  favsBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (isOpen) {
    renderFavouritesPanel();
  }
}

function toggleFavourite(id) {
  if (favouriteIds.has(id)) {
    favouriteIds.delete(id);
  } else {
    favouriteIds.add(id);
  }
  saveFavourites();
  updateFavouritesCounter();
  updateFavouriteToggles();
  renderFavouritesPanel();
}

function updateFavouriteToggles() {
  document.querySelectorAll('[data-fav-toggle="true"][data-id]').forEach((el) => {
    const id = (el.getAttribute('data-id') || '').trim();
    const isFav = id ? favouriteIds.has(id) : false;
    el.classList.toggle('fav-toggle--active', isFav);
    el.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    const label = isFav ? 'Remove from favourites' : 'Add to favourites';
    el.setAttribute('aria-label', label);
  });
}

function setupFavourites() {
  updateFavouritesCounter();
  renderFavouritesPanel();

  if (favsBtn) {
    favsBtn.addEventListener('click', () => {
      const isOpen = favsPanel && !favsPanel.classList.contains('is-hidden');
      setFavouritesPanelOpen(!isOpen);
    });
  }

  if (favsCloseBtn) {
    favsCloseBtn.addEventListener('click', () => setFavouritesPanelOpen(false));
  }

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const toggle = target.closest('[data-fav-toggle="true"][data-id]');
    if (!toggle) return;

    e.preventDefault();
    e.stopPropagation();

    const id = (toggle.getAttribute('data-id') || '').trim();
    if (!id) return;
    toggleFavourite(id);
  });
}

function setupHeaderCreateGiftVisibility() {
  const header = document.querySelector('.header');
  const headerCtas = document.querySelectorAll('.header .header__actions a.btn.btn--sm');
  const startCreatingBtn = document.querySelector('.hero__cta a.btn.btn--primary[href="#create-gift"]');

  if (!header || headerCtas.length === 0 || !startCreatingBtn) return;

  const setHidden = (hidden) => {
    headerCtas.forEach((cta) => {
      cta.classList.toggle('is-hidden', hidden);
      cta.setAttribute('aria-hidden', hidden ? 'true' : 'false');
      if (hidden) {
        cta.setAttribute('tabindex', '-1');
      } else {
        cta.removeAttribute('tabindex');
      }
    });
  };

  const isStartCreatingVisibleBelowHeader = () => {
    const headerHeight = Math.ceil(header.getBoundingClientRect().height || 0);
    const rect = startCreatingBtn.getBoundingClientRect();
    return rect.bottom > headerHeight && rect.top < window.innerHeight;
  };

  // Default hidden (prevents initial blink), then immediately compute the real state.
  setHidden(true);
  requestAnimationFrame(() => {
    setHidden(isStartCreatingVisibleBelowHeader());
  });

  let observer = null;
  let resizeRaf = 0;

  const createObserver = () => {
    if (observer) observer.disconnect();

    const headerHeight = Math.ceil(header.getBoundingClientRect().height || 0);
    observer = new IntersectionObserver(
      (entries) => {
        const isVisibleBelowHeader = entries.some((entry) => entry.isIntersecting);
        setHidden(isVisibleBelowHeader);
      },
      {
        root: null,
        // Negative top margin means the element counts as visible only once it
        // is below the fixed header.
        rootMargin: `-${headerHeight}px 0px 0px 0px`,
        threshold: 0.01
      }
    );

    observer.observe(startCreatingBtn);
  };

  createObserver();

  window.addEventListener(
    'resize',
    () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(createObserver);
    },
    { passive: true }
  );
}

// Render experience showcase grid
function renderExperienceShowcase() {
  const filtered = currentFilter === 'all' 
    ? experiences 
    : experiences.filter(exp => exp.category === currentFilter);

  const pageSize = getExperiencePageSize();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  experiencesPage = Math.min(Math.max(1, experiencesPage), totalPages);
  const startIndex = (experiencesPage - 1) * pageSize;
  const visible = filtered.slice(startIndex, startIndex + pageSize);
  
  if (experienceGrid) {
    experienceGrid.innerHTML = visible.map(renderExperienceCard).join('');
  }

  updateFavouriteToggles();
  renderExperiencePagination(totalPages);
  syncExperienceFooterVisibility(filtered.length);
}

// Render builder grid
function renderBuilderGrid(searchQuery = '') {
  if (
    builderExpanded &&
    builderMain instanceof HTMLElement &&
    typeof builderMainLockedMinHeight === 'number'
  ) {
    builderMain.style.minHeight = `${builderMainLockedMinHeight}px`;
  }

  const query = String(searchQuery || '').trim().toLowerCase();
  const filtered = query
    ? experiences.filter((exp) => exp.title.toLowerCase().includes(query))
    : experiences;

  const pageSize = getBuilderPageSize();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  builderPage = Math.min(Math.max(1, builderPage), totalPages);
  const startIndex = (builderPage - 1) * pageSize;
  const visible = filtered.slice(startIndex, startIndex + pageSize);

  if (builderGrid) {
    const itemsHtml = visible.map(renderBuilderCard);

    // When expanded, keep the grid height stable across pages by padding
    // the last page with invisible placeholders (so rows don't collapse).
    if (builderExpanded) {
      const missing = Math.max(0, pageSize - visible.length);
      for (let i = 0; i < missing; i += 1) {
        itemsHtml.push('<article class="builder-card builder-card--placeholder" aria-hidden="true"></article>');
      }
    }

    builderGrid.innerHTML = itemsHtml.join('');
  }

  updateFavouriteToggles();
  renderBuilderPagination(totalPages);
  syncBuilderFooterVisibility(filtered.length);
  scheduleBuilderHeightLock();
}

// Toggle experience selection
function toggleExperience(id) {
  const experience = experiences.find(e => e.id === id);
  if (!experience) return;
  
  const index = selectedExperiences.findIndex(e => e.id === id);
  
  if (index > -1) {
    // Remove
    selectedExperiences.splice(index, 1);
    triggerHaptic();
  } else if (selectedExperiences.length < MAX_SELECTIONS) {
    // Add
    selectedExperiences.push(experience);
    triggerHaptic();
    triggerConfettiPop();
  }
  
  updatePackUI();
  renderBuilderGrid(getSearchQuery());
}

// Update pack UI
function updatePackUI() {
  if (packCount) packCount.textContent = `${selectedExperiences.length}/${MAX_SELECTIONS}`;
  if (sendGiftBtn) sendGiftBtn.disabled = selectedExperiences.length === 0;
  
  if (selectedExperiences.length === 0) {
    if (!packItems) return;
    packItems.innerHTML = `
      <div class="builder__empty">
        <span class="builder__empty-icon">💫</span>
        <p>Select experiences from the grid to add them to your gift pack!</p>
      </div>
    `;
  } else {
    if (!packItems) return;
    packItems.innerHTML = selectedExperiences.map(exp => `
      <div class="builder__item" data-id="${exp.id}">
        <img class="builder__item-image" src="${exp.image}" alt="${exp.title}" />
        <div class="builder__item-info">
          <div class="builder__item-title">${exp.title}</div>
          <div class="builder__item-price">$${exp.price}</div>
        </div>
        <button class="builder__item-remove" data-id="${exp.id}">✕</button>
      </div>
    `).join('');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Category tabs
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('tab--active'));
      tab.classList.add('tab--active');
      currentFilter = tab.dataset.category;
      experiencesPage = 1;
      renderExperienceShowcase();
    });
  });

  if (expPagination) {
    expPagination.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest('[data-exp-page]');
      if (!btn) return;
      const page = parseInt(btn.getAttribute('data-exp-page') || '', 10);
      if (!Number.isFinite(page)) return;
      experiencesPage = page;
      renderExperienceShowcase();
    });
  }

  if (expSeeMoreBtn) {
    expSeeMoreBtn.addEventListener('click', () => {
      experiencesExpanded = true;
      experiencesPage = 1;
      renderExperienceShowcase();
    });
  }

  let expResizeRaf = 0;
  window.addEventListener(
    'resize',
    () => {
      if (expResizeRaf) cancelAnimationFrame(expResizeRaf);
      expResizeRaf = requestAnimationFrame(() => {
        renderExperienceShowcase();
      });
    },
    { passive: true }
  );

  if (builderGrid) {
    builderGrid.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      // Clicking the favourites toggle should not select/deselect the card.
      if (target.closest('[data-fav-toggle="true"][data-id]')) return;

      const card = target.closest('.builder-card');
      if (!card || card.classList.contains('builder-card--disabled')) return;

      const id = (card.getAttribute('data-id') || '').trim();
      if (!id) return;
      toggleExperience(id);
    });
  }

  if (packItems) {
    packItems.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const removeBtn = target.closest('.builder__item-remove');
      if (!removeBtn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = (removeBtn.getAttribute('data-id') || '').trim();
      if (!id) return;
      toggleExperience(id);
    });
  }
  
  // Search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const next = e.target;
      if (!(next instanceof HTMLInputElement)) return;
      builderExpanded = false;
      builderPage = 1;
      clearBuilderHeightLock();
      renderBuilderGrid(next.value);
    });
  }

  if (builderPagination) {
    builderPagination.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest('[data-builder-page]');
      if (!btn) return;
      const page = parseInt(btn.getAttribute('data-builder-page') || '', 10);
      if (!Number.isFinite(page)) return;
      builderPage = page;
      renderBuilderGrid(getSearchQuery());
    });
  }

  if (builderSeeMoreBtn) {
    builderSeeMoreBtn.addEventListener('click', () => {
      builderExpanded = true;
      builderPage = 1;
      builderMainLockedMinHeight = null;
      renderBuilderGrid(getSearchQuery());
    });
  }
  
  // Send gift
  if (sendGiftBtn) sendGiftBtn.addEventListener('click', sendGift);
  
  // Close modal
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  const backdrop = successModal?.querySelector?.('.modal__backdrop');
  if (backdrop) backdrop.addEventListener('click', closeModal);
}

// Send gift
function sendGift() {
  if (!recipientName || !recipientDisplay || !successModal) return;
  const name = recipientName.value.trim() || 'Your loved one';
  
  recipientDisplay.textContent = name;
  successModal.hidden = false;
  
  // Trigger celebration
  createCelebrationConfetti();
  
  // Reset after modal closes
}

// Close modal and reset
function closeModal() {
  if (!successModal) return;
  successModal.hidden = true;
  selectedExperiences = [];
  if (recipientName) recipientName.value = '';
  if (giftMessage) giftMessage.value = '';
  updatePackUI();
  renderBuilderGrid();
}

// Haptic feedback simulation
function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

// Simple confetti pop
function triggerConfettiPop() {
  const container = document.body;
  
  for (let i = 0; i < 8; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${pickRandom(POP_CONFETTI_COLORS)};
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      left: 50%;
      top: 50%;
    `;
    
    const angle = (Math.PI * 2 * i) / 8;
    const velocity = 100 + Math.random() * 100;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    
    confetti.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
    ], {
      duration: 600,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), 600);
  }
}

// Create celebration confetti
function createCelebrationConfetti() {
  const container = document.body;
  
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      const size = 8 + Math.random() * 8;
      const isCircle = Math.random() > 0.5;
      
      confetti.style.cssText = `
        position: fixed;
        width: ${size}px;
        height: ${size}px;
        background: ${pickRandom(CELEBRATION_CONFETTI_COLORS)};
        border-radius: ${isCircle ? '50%' : '2px'};
        pointer-events: none;
        z-index: 9999;
        left: ${Math.random() * 100}vw;
        top: -20px;
      `;
      
      const duration = 2000 + Math.random() * 2000;
      const drift = (Math.random() - 0.5) * 200;
      
      confetti.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(100vh) translateX(${drift}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ], {
        duration: duration,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      });
      
      container.appendChild(confetti);
      setTimeout(() => confetti.remove(), duration);
    }, i * 30);
  }
}

// Create subtle background confetti
function createConfetti() {
  const container = document.querySelector('.confetti-bg');
  if (!container) return;
  
  const colors = ['rgba(124, 92, 255, 0.3)', 'rgba(236, 72, 153, 0.3)', 'rgba(16, 185, 129, 0.3)'];
  const diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
  const totalDots = BACKGROUND_CONFETTI_COUNT;

  for (let i = 0; i < totalDots; i++) {
    const dot = document.createElement('div');
    const size = 4 + Math.random() * 10;
    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    const baseAngle = Math.random() * Math.PI * 2;
    const driftAngles = [
      baseAngle + randomRange(-0.25, 0.25),
      baseAngle + randomRange(-0.15, 0.35),
      baseAngle + randomRange(-0.3, 0.3)
    ];
    const distances = [
      randomRange(0.25, 0.4),
      randomRange(0.45, 0.7),
      randomRange(0.85, 1.1)
    ].map(ratio => ratio * diagonal);

    dot.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${pickRandom(colors)};
      border-radius: ${Math.random() > 0.65 ? '999px' : '50%'};
      left: ${startX}%;
      top: ${startY}%;
      opacity: 0.35;
      transform: translate3d(0, 0, 0);
    `;

    const keyframes = [
      { transform: 'translate3d(0, 0, 0)', opacity: 0.2 },
      {
        transform: `translate3d(${Math.cos(driftAngles[0]) * distances[0]}px, ${Math.sin(driftAngles[0]) * distances[0]}px, 0)`,
        opacity: 0.45
      },
      {
        transform: `translate3d(${Math.cos(driftAngles[1]) * distances[1]}px, ${Math.sin(driftAngles[1]) * distances[1]}px, 0)`,
        opacity: 0.5
      },
      {
        transform: `translate3d(${Math.cos(driftAngles[2]) * distances[2]}px, ${Math.sin(driftAngles[2]) * distances[2]}px, 0)`,
        opacity: 0.2
      }
    ];

    const duration = randomRange(22000, 36000);
    const animation = dot.animate(keyframes, {
      duration,
      iterations: Infinity,
      easing: 'linear',
      delay: randomRange(0, 5000)
    });

    animation.currentTime = randomRange(0, duration);
    container.appendChild(dot);
  }
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});
