/* Main Application Entry Point */

import type { Experience } from '../types';
import { disableNativeImageDrag } from '../utils.js';
import { initializeCardStack } from './cardStack.js';
import { initializeCarousel, setupCarouselCardInteractions } from './carousel.js';
import { initializeEasterEgg } from './easterEgg.js';
import { initializeEmailValidation } from './emailValidation.js';

// Load HTML component
async function loadComponent(elementId: string, componentPath: string): Promise<void> {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`Failed to load ${componentPath}`);
    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    console.error('Component loading error:', error);
  }
}

// Load experiences data
async function loadExperiences(): Promise<Experience[]> {
  try {
    const response = await fetch('./data/experiences.json');
    if (!response.ok) throw new Error('Failed to load experiences data');
    return await response.json();
  } catch (error) {
    console.error('Experiences data loading error:', error);
    return [];
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Load experiences data first
  const experiences = await loadExperiences();
  
  // Randomize experience order on each page load
  const shuffledExperiences = experiences.sort(() => Math.random() - 0.5);
  
  // Load all components in parallel
  await Promise.all([
    loadComponent('heroContent', './html_components/hero-waitinglist-subscription.html'),
    loadComponent('experiencesCarousel', './html_components/experiences-carousel.html'),
    loadComponent('footerContent', './html_components/footer.html')
  ]);
  
  // After hero content loads, load the nested hero visual component
  await loadComponent('heroVisual', './html_components/hero-card-stack.html');
  
  // Initialize modules (card stack now virtualized)
  initializeCardStack(shuffledExperiences);
  initializeCarousel(shuffledExperiences);
  setupCarouselCardInteractions();
  initializeEasterEgg();
  initializeEmailValidation();

  // Disable native image dragging once DOM nodes exist
  disableNativeImageDrag('.card img, .xp-card img');
});
