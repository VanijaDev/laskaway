# Code Architecture

This project has been refactored into a modular structure following best practices for maintainability and separation of concerns.

## File Structure

```
├── script.ts              # Main application entry point
├── types.ts               # Shared TypeScript type definitions
├── utils.ts               # Shared utility functions and constants
├── cardStack.ts           # Card stack (Tinder-style swipe) module
├── carousel.ts            # Carousel (infinite scrolling) module
├── easterEgg.ts           # Easter egg animations module
├── data/
│   └── experiences.json   # Experience data
└── build/                 # Compiled JavaScript output
    ├── script.js
    ├── types.js
    ├── utils.js
    ├── cardStack.js
    ├── carousel.js
    ├── easterEgg.js
    └── data/
```

## Module Descriptions

### `script.ts` - Main Entry Point
- Coordinates all modules
- Loads HTML components and experience data
- Initializes all interactive features
- **Responsibilities**: Application bootstrapping, component loading

### `types.ts` - Type Definitions
- `Experience` interface definition
- Shared across all modules for type safety
- **Responsibilities**: Type definitions only

### `utils.ts` - Shared Utilities
- Common helper functions used by multiple modules
- Confetti particle creators
- Haptic feedback
- Image drag prevention
- **Responsibilities**: Reusable utilities, constants

### `cardStack.ts` - Card Stack Module
- Tinder-style swipeable card stack
- Drag-to-swipe interactions
- Like/Nope feedback
- Gift box reveal when 5 cards are liked
- Demo animations and wiggle effects
- **Responsibilities**: All card stack logic and interactions

### `carousel.ts` - Carousel Module
- Infinite scrolling experience carousel
- Drag-to-pan support
- Tag filtering
- Auto-scroll animation
- Click-to-open cards
- **Responsibilities**: All carousel logic and interactions

### `easterEgg.ts` - Easter Egg Module
- Fun animations triggered by logo click
- Rainbow wave, dancing cards, gentle sway, tumbling cards, wind gust
- Random effect selection
- **Responsibilities**: Entertainment features

## Module Dependencies

```
script.ts (main)
  ├── imports: types, utils, cardStack, carousel, easterEgg
  └── initializes all modules

cardStack.ts
  ├── imports: types, utils
  └── exports: generateCardStack(), initializeCardStack()

carousel.ts
  ├── imports: types, utils
  └── exports: generateCarousel(), initializeCarousel(), setupCarouselCardInteractions()

easterEgg.ts
  └── exports: initializeEasterEgg()

utils.ts
  └── exports: utility functions, constants

types.ts
  └── exports: TypeScript interfaces
```

## Benefits of This Architecture

1. **Separation of Concerns**: Each module handles a specific feature
2. **Maintainability**: Easier to find and fix bugs in isolated modules
3. **Reusability**: Modules can be reused or tested independently
4. **Scalability**: Easy to add new features as separate modules
5. **Readability**: Smaller, focused files are easier to understand
6. **Type Safety**: Shared types ensure consistency across modules

## Development

### Building
```bash
npm run build
```
This compiles all TypeScript modules to ES2020 JavaScript modules in the `build/` directory.

### Development Server
```bash
npm run dev
```
Starts a live-reloading dev server and watches for TypeScript changes.

### Adding New Features

1. Create a new `.ts` file in the root directory
2. Import types from `types.ts` and utilities from `utils.ts`
3. Export initialization function(s)
4. Import and call from `script.ts`
5. Run `npm run build`

## Migration Notes

The original monolithic `script.ts` has been backed up as `script-old.ts`. The refactored code maintains 100% feature parity with improved organization.
