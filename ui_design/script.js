/* ============================================
   Laskaway UI - JavaScript
   Experience Gift Service
   ============================================ */

// Sample experience data
const experiences = [
  {
    id: 1,
    title: 'Hot Air Balloon Ride',
    category: 'adventure',
    price: 299,
    duration: '2-3 hours',
    image: 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=600&h=400&fit=crop',
    badge: 'Popular'
  },
  {
    id: 2,
    title: 'Luxury Spa Day',
    category: 'relax',
    price: 189,
    duration: '4-5 hours',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop',
    badge: null
  },
  {
    id: 3,
    title: 'Michelin Star Dining',
    category: 'food',
    price: 350,
    duration: '2-3 hours',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop',
    badge: 'Premium'
  },
  {
    id: 4,
    title: 'Skydiving Adventure',
    category: 'adventure',
    price: 399,
    duration: '3-4 hours',
    image: 'https://images.unsplash.com/photo-1521673461164-de300ebcfb17?w=600&h=400&fit=crop',
    badge: 'Thrill'
  },
  {
    id: 5,
    title: 'Wine Tasting Tour',
    category: 'food',
    price: 149,
    duration: '4-5 hours',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=400&fit=crop',
    badge: null
  },
  {
    id: 6,
    title: 'Sunset Yacht Cruise',
    category: 'relax',
    price: 249,
    duration: '3 hours',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop',
    badge: 'Romantic'
  },
  {
    id: 7,
    title: 'Museum Private Tour',
    category: 'culture',
    price: 129,
    duration: '2-3 hours',
    image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&h=400&fit=crop',
    badge: null
  },
  {
    id: 8,
    title: 'Cooking Masterclass',
    category: 'food',
    price: 179,
    duration: '3-4 hours',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&h=400&fit=crop',
    badge: null
  },
  {
    id: 9,
    title: 'Rock Climbing',
    category: 'adventure',
    price: 99,
    duration: '2-3 hours',
    image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600&h=400&fit=crop',
    badge: null
  },
  {
    id: 10,
    title: 'Meditation Retreat',
    category: 'relax',
    price: 159,
    duration: 'Full day',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=400&fit=crop',
    badge: null
  },
  {
    id: 11,
    title: 'Theater Show & Dinner',
    category: 'culture',
    price: 219,
    duration: '4-5 hours',
    image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=600&h=400&fit=crop',
    badge: null
  },
  {
    id: 12,
    title: 'Helicopter Tour',
    category: 'adventure',
    price: 499,
    duration: '1-2 hours',
    image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&h=400&fit=crop',
    badge: 'Exclusive'
  }
];

// State
let selectedExperiences = [];
let currentFilter = 'all';
const MAX_SELECTIONS = 5;

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderExperienceShowcase();
  renderBuilderGrid();
  setupEventListeners();
  createConfetti();
});

// Render experience showcase grid
function renderExperienceShowcase() {
  const filtered = currentFilter === 'all' 
    ? experiences 
    : experiences.filter(exp => exp.category === currentFilter);
  
  experienceGrid.innerHTML = filtered.map(exp => `
    <article class="exp-card" data-id="${exp.id}">
      <div class="exp-card__image">
        <img src="${exp.image}" alt="${exp.title}" loading="lazy" />
        ${exp.badge ? `<span class="exp-card__badge">${exp.badge}</span>` : ''}
      </div>
      <div class="exp-card__content">
        <h3 class="exp-card__title">${exp.title}</h3>
        <div class="exp-card__meta">
          <span>🕐 ${exp.duration}</span>
          <span class="exp-card__price">$${exp.price}</span>
        </div>
      </div>
    </article>
  `).join('');
}

// Render builder grid
function renderBuilderGrid(searchQuery = '') {
  const filtered = experiences.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });
  
  builderGrid.innerHTML = filtered.map(exp => {
    const isSelected = selectedExperiences.some(e => e.id === exp.id);
    const isDisabled = !isSelected && selectedExperiences.length >= MAX_SELECTIONS;
    
    return `
      <article class="builder-card ${isSelected ? 'builder-card--selected' : ''} ${isDisabled ? 'builder-card--disabled' : ''}" 
               data-id="${exp.id}">
        <div class="builder-card__image">
          <img src="${exp.image}" alt="${exp.title}" loading="lazy" />
        </div>
        <div class="builder-card__content">
          <h4 class="builder-card__title">${exp.title}</h4>
          <div class="builder-card__meta">
            <span>🕐 ${exp.duration}</span>
            <span class="builder-card__price">$${exp.price}</span>
          </div>
        </div>
        <div class="builder-card__check">✓</div>
      </article>
    `;
  }).join('');
  
  // Attach click handlers
  document.querySelectorAll('.builder-card:not(.builder-card--disabled)').forEach(card => {
    card.addEventListener('click', () => toggleExperience(parseInt(card.dataset.id)));
  });
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
  renderBuilderGrid(searchInput.value);
}

// Update pack UI
function updatePackUI() {
  packCount.textContent = `${selectedExperiences.length}/${MAX_SELECTIONS}`;
  sendGiftBtn.disabled = selectedExperiences.length === 0;
  
  if (selectedExperiences.length === 0) {
    packItems.innerHTML = `
      <div class="builder__empty">
        <span class="builder__empty-icon">💫</span>
        <p>Select experiences from the grid to add them to your gift pack!</p>
      </div>
    `;
  } else {
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
    
    // Attach remove handlers
    document.querySelectorAll('.builder__item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExperience(parseInt(btn.dataset.id));
      });
    });
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
      renderExperienceShowcase();
    });
  });
  
  // Search
  searchInput.addEventListener('input', (e) => {
    renderBuilderGrid(e.target.value);
  });
  
  // Send gift
  sendGiftBtn.addEventListener('click', sendGift);
  
  // Close modal
  closeModalBtn.addEventListener('click', closeModal);
  successModal.querySelector('.modal__backdrop').addEventListener('click', closeModal);
}

// Send gift
function sendGift() {
  const name = recipientName.value.trim() || 'Your loved one';
  
  recipientDisplay.textContent = name;
  successModal.hidden = false;
  
  // Trigger celebration
  createCelebrationConfetti();
  
  // Reset after modal closes
}

// Close modal and reset
function closeModal() {
  successModal.hidden = true;
  selectedExperiences = [];
  recipientName.value = '';
  giftMessage.value = '';
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
  const colors = ['#7c5cff', '#ec4899', '#10b981', '#f59e0b'];
  const container = document.body;
  
  for (let i = 0; i < 8; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
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
  const colors = ['#7c5cff', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];
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
        background: ${colors[Math.floor(Math.random() * colors.length)]};
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
  
  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('div');
    const size = 4 + Math.random() * 8;
    
    dot.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: floatDot ${5 + Math.random() * 10}s ease-in-out infinite;
      animation-delay: ${Math.random() * 5}s;
    `;
    
    container.appendChild(dot);
  }
  
  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes floatDot {
      0%, 100% { transform: translate(0, 0); opacity: 0.5; }
      25% { transform: translate(20px, -20px); opacity: 0.8; }
      50% { transform: translate(-10px, -40px); opacity: 0.5; }
      75% { transform: translate(-30px, -20px); opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);
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
