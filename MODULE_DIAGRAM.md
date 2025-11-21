# Module Architecture Diagram

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                              │
│                  <script type="module"                          │
│                   src="build/script.js">                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      script.ts (Main)                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ • Load HTML components                                     │ │
│  │ • Fetch experience data                                    │ │
│  │ • Initialize all modules                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
└──┬────────┬────────────┬───────────────┬──────────────┬────────┘
   │        │            │               │              │
   ▼        ▼            ▼               ▼              ▼
┌──────┐ ┌────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
│types │ │ utils  │ │cardStack │ │ carousel   │ │  easterEgg   │
│  .ts │ │  .ts   │ │   .ts    │ │    .ts     │ │     .ts      │
└──────┘ └────────┘ └──────────┘ └────────────┘ └──────────────┘
   ▲        ▲            │               │              │
   │        │            │               │              │
   └────────┴────────────┴───────────────┴──────────────┘
              Imports / Dependencies
```

## Module Hierarchy

### Level 1: Foundation
```
┌─────────────────┐
│    types.ts     │  ← Type definitions (no dependencies)
└─────────────────┘

┌─────────────────┐
│    utils.ts     │  ← Utilities (no dependencies)
└─────────────────┘
```

### Level 2: Features
```
┌─────────────────────────┐
│    cardStack.ts         │  ← Imports: types.ts, utils.ts
│                         │
│  • Swipe interactions   │
│  • Like/Nope logic      │
│  • Gift box reveal      │
│  • Demo animations      │
└─────────────────────────┘

┌─────────────────────────┐
│    carousel.ts          │  ← Imports: types.ts, utils.ts
│                         │
│  • Infinite scroll      │
│  • Drag-to-pan          │
│  • Tag filtering        │
│  • Click handlers       │
└─────────────────────────┘

┌─────────────────────────┐
│    easterEgg.ts         │  ← No imports
│                         │
│  • Logo click handler   │
│  • Animation effects    │
│  • Random selection     │
└─────────────────────────┘
```

### Level 3: Orchestrator
```
┌──────────────────────────────────────────┐
│           script.ts (Main)               │
│                                          │
│  Imports ALL modules and coordinates:    │
│                                          │
│  1. Load components                      │
│  2. Fetch data                           │
│  3. Initialize cardStack                 │
│  4. Initialize carousel                  │
│  5. Initialize easterEgg                 │
└──────────────────────────────────────────┘
```

## Data Flow

```
User Action
    │
    ▼
┌─────────────────────────────────┐
│  DOM Event (click, drag, etc.)  │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│    Module Event Handler         │
│  (cardStack / carousel)         │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│    Update DOM / State           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Call Utils (confetti, haptic)  │
└─────────────────────────────────┘
```

## Initialization Sequence

```
1. DOMContentLoaded
        │
        ▼
2. Load Experiences Data (JSON)
        │
        ▼
3. Load HTML Components (parallel)
        │
        ├── Hero content
        ├── Carousel
        └── Footer
        │
        ▼
4. Populate DOM
        │
        ├── Generate card stack HTML
        └── Generate carousel HTML
        │
        ▼
5. Initialize Modules
        │
        ├── initializeCardStack()
        ├── initializeCarousel()
        ├── setupCarouselCardInteractions()
        └── initializeEasterEgg()
        │
        ▼
6. Ready for User Interaction
```

## File Size Comparison

### Before Refactoring
```
script.ts: ████████████████████████████████ (1133 lines)
```

### After Refactoring
```
script.ts:    ██▌ (75 lines)   - Main entry
types.ts:     ▌ (10 lines)     - Types
utils.ts:     ██ (75 lines)    - Utilities
cardStack.ts: ████████████▌ (550 lines) - Card stack
carousel.ts:  ████ (175 lines) - Carousel
easterEgg.ts: ███ (125 lines)  - Easter egg
────────────────────────────────────────
Total:        ~1010 lines (better organized)
```

## Benefits Visualization

```
┌─────────────────────────────────────────────────────────┐
│                    BEFORE                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                    │ │
│  │              script.ts (1133 lines)               │ │
│  │                                                    │ │
│  │  Everything mixed together:                       │ │
│  │  • Types                                          │ │
│  │  • Utils                                          │ │
│  │  • Card stack                                     │ │
│  │  • Carousel                                       │ │
│  │  • Easter egg                                     │ │
│  │  • Initialization                                 │ │
│  │                                                    │ │
│  │  Hard to maintain ❌                              │ │
│  │  Hard to test ❌                                  │ │
│  │  Hard to extend ❌                                │ │
│  │                                                    │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    AFTER                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ types.ts │ │ utils.ts │ │script.ts │               │
│  │  (10 L)  │ │  (75 L)  │ │  (75 L)  │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │cardStack.ts  │ │ carousel.ts  │ │easterEgg.ts  │   │
│  │   (550 L)    │ │   (175 L)    │ │   (125 L)    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                          │
│  Easy to maintain ✅                                    │
│  Easy to test ✅                                        │
│  Easy to extend ✅                                      │
│  Clear responsibilities ✅                              │
│  Better collaboration ✅                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Quick Reference

### Adding a New Feature

1. Create `newFeature.ts`
2. Import from `types.ts` and `utils.ts` as needed
3. Export `initializeNewFeature()`
4. Add import to `script.ts`
5. Call initialization in DOMContentLoaded
6. Run `npm run build`

### Modifying Existing Feature

1. Open relevant module file
2. Make changes in isolation
3. Run `npm run build`
4. Test specific feature

### Testing Strategy

```
Unit Tests (Future)
  ├── types.test.ts
  ├── utils.test.ts
  ├── cardStack.test.ts
  ├── carousel.test.ts
  └── easterEgg.test.ts

Integration Tests
  └── script.test.ts
```
