/* Main Application Entry Point */

import { disableNativeImageDrag } from '../utils.js';
import { initializeCardStack } from './modules/cardStack.js';
import { initializeCarousel } from './modules/carousel.js';
import { initializeEasterEgg } from './modules/easterEgg.js';
import type { ComponentDefinition } from './services/componentLoader.js';
import { loadComponent, loadComponents } from './services/componentLoader.js';
import { fetchExperiences, shuffleExperiences } from './services/experienceService.js';

const HERO_CONTENT_COMPONENT: ComponentDefinition = {
  hostId: 'heroContent',
  url: './html_components/hero-waitinglist-subscription.html',
};

const STATIC_COMPONENTS: ComponentDefinition[] = [
  { hostId: 'experiencesCarousel', url: './html_components/experiences-carousel.html' },
  { hostId: 'footerContent', url: './html_components/footer.html' },
];

const HERO_STACK_COMPONENT: ComponentDefinition = {
  hostId: 'heroVisual',
  url: './html_components/hero-card-stack.html',
};

async function bootstrapApplication(): Promise<void> {
  try {
    // Ensure hero shell exists before injecting the stack markup
    await loadComponent(HERO_CONTENT_COMPONENT);

    const [experiences] = await Promise.all([
      fetchExperiences(),
      loadComponents(STATIC_COMPONENTS),
      loadComponent(HERO_STACK_COMPONENT),
    ]);

    if (!experiences.length) {
      console.warn('No experiences available — skipping interactive modules.');
      return;
    }

    const preparedExperiences = shuffleExperiences(experiences);

    initializeCardStack(preparedExperiences);
    initializeCarousel(preparedExperiences);
    initializeEasterEgg();
    disableNativeImageDrag('.card img, .xp-card img');
  } catch (error) {
    console.error('App initialization failed:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void bootstrapApplication();
});
