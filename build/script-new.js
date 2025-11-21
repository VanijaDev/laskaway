/* Main Application Entry Point */
import { disableNativeImageDrag } from './utils';
import { generateCardStack, initializeCardStack } from './cardStack';
import { generateCarousel, initializeCarousel, setupCarouselCardInteractions } from './carousel';
import { initializeEasterEgg } from './easterEgg';
// Load HTML component
async function loadComponent(elementId, componentPath) {
    const container = document.getElementById(elementId);
    if (!container)
        return;
    try {
        const response = await fetch(componentPath);
        if (!response.ok)
            throw new Error(`Failed to load ${componentPath}`);
        const html = await response.text();
        container.innerHTML = html;
    }
    catch (error) {
        console.error('Component loading error:', error);
    }
}
// Load experiences data
async function loadExperiences() {
    try {
        const response = await fetch('./data/experiences.json');
        if (!response.ok)
            throw new Error('Failed to load experiences data');
        return await response.json();
    }
    catch (error) {
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
    // Populate card stack and carousel with experience data
    const cardStack = document.getElementById('cardStack');
    const scrollerTrack = document.querySelector('.scroller__track');
    if (cardStack && shuffledExperiences.length > 0) {
        cardStack.innerHTML = generateCardStack(shuffledExperiences);
    }
    if (scrollerTrack && shuffledExperiences.length > 0) {
        // Clear existing content but preserve the data attribute
        const isDuplicate = scrollerTrack.dataset.duplicate === 'true';
        scrollerTrack.innerHTML = generateCarousel(shuffledExperiences);
        // Re-apply duplication logic if needed
        if (isDuplicate) {
            const originalChildren = Array.from(scrollerTrack.children);
            originalChildren.forEach((el) => { el.dataset.original = 'true'; });
            originalChildren.forEach((node) => {
                const clone = node.cloneNode(true);
                delete clone.dataset.original;
                scrollerTrack.appendChild(clone);
            });
        }
    }
    // Disable native image dragging on stack and carousel images
    disableNativeImageDrag('.card img, .xp-card img');
    // Initialize modules
    initializeCardStack(shuffledExperiences);
    initializeCarousel();
    setupCarouselCardInteractions();
    initializeEasterEgg();
});
