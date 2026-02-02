# Tracker Modular Structure

## Overview
The tracker application has been refactored into modular CSS and JavaScript files for better maintainability and collaboration.

## CSS Modules (`css/modules/`)

All CSS has been split into 10 focused modules:

| Module | Purpose | Lines |
|--------|---------|-------|
| `base.css` | Base styles, typography, body styling | ~7 |
| `timeline.css` | Timeline vertical line and item styling | ~24 |
| `speech-recording.css` | Hero card, speech UI, waveform animations | ~56 |
| `swipe-actions.css` | Swipe containers and action buttons | ~26 |
| `modals.css` | Modal overlays, animations, content styling | ~68 |
| `filters.css` | Filter chips, segmented controls, navigation | ~211 |
| `dashboard.css` | Dashboard grid, metric cards, stats display | ~194 |
| `animations.css` | Shake, slide-in, pop-out animations | ~65 |
| `mobile.css` | Mobile-specific styles, touch optimizations | ~266 |
| `responsive.css` | Media queries for different screen sizes | ~80 |

### Usage
Import the main CSS file in `tracker.html`:
```html
<link rel="stylesheet" href="css/tracker-main.css">
```

The main file automatically imports all modules in the correct order.

### Modifying Styles
To change styles for a specific feature:
- **Timeline appearance** → Edit `css/modules/timeline.css`
- **Speech recording UI** → Edit `css/modules/speech-recording.css`
- **Modal dialogs** → Edit `css/modules/modals.css`
- **Dashboard metrics** → Edit `css/modules/dashboard.css`
- **Mobile layout** → Edit `css/modules/mobile.css`

## JavaScript Modules (`js/modules/`)

JavaScript code is organized into focused modules (work in progress):

| Module | Purpose | Key Components |
|--------|---------|----------------|
| `config.js` | API endpoints, constants | API_BASE_URL, STORAGE_KEYS, placeholderPrompts |
| `state.js` | Application state variables | entries, speechEntries, trendChart, filters |
| `dom-refs.js` | DOM element references | All element selectors organized by feature |
| `datetime-utils.js` | Date/time helpers | getCurrentDateTime, parseDateTime, formatDuration |
| `speech-recording.js` | Speech capture logic | startRecording, stopRecording, transcription |
| `notifications.js` | Diaper alerts | fetchWebhookConfig, sendNotification, timer updates |
| `modals.js` | Modal management | openModal, closeModal, form handlers |
| `entries.js` | CRUD operations | fetchEntries, addEntry, updateEntry, deleteEntry |
| `statistics.js` | Stats calculations | updateStats, calculateAverages, trends |
| `charts.js` | Chart.js integration | initializeChart, updateChart, data processing |
| `interactions.js` | UI interactions | Long press, swipe, shake animations |
| `init.js` | Initialization | Event listeners, page load, SSE connections |

### Current Implementation
The JavaScript is currently in a single file (`js/tracker.js`) with clear section markers. Modularization is in progress.

To modify functionality:
1. Locate the relevant section using section comments (e.g., `// SECTION: Modal Management`)
2. Find the specific function using JSDoc comments
3. Make your changes within that section

### Future Migration
The monolithic `tracker.js` will be split into the modules above with:
- Proper imports/exports (ES6 modules)
- Clear dependency chains
- Individual module testing

## File Organization Principles

### 1. Single Responsibility
Each module handles one specific aspect of the application:
- **Modals module** = Only modal dialog logic
- **Charts module** = Only Chart.js visualization
- **Notifications module** = Only diaper timer/alerts

### 2. Clear Dependencies
Modules are ordered by dependencies:
```
config.js (no dependencies)
  ↓
state.js (uses config)
  ↓
dom-refs.js (uses state)
  ↓
utilities (datetime-utils, etc.)
  ↓
features (speech, modals, entries, etc.)
  ↓
init.js (uses everything)
```

### 3. Easy Navigation
Find code quickly:
- **CSS**: Check module name (dashboard.css for dashboard changes)
- **JS**: Check section headers in tracker.js
- **Functions**: Use JSDoc comments to search

## Development Workflow

### Making Changes

**For CSS changes:**
1. Identify which visual component you're changing
2. Open the corresponding module in `css/modules/`
3. Make your changes
4. Test in browser (changes apply immediately)

**For JavaScript changes:**
1. Open `js/tracker.js`
2. Use Ctrl+F to find the section (e.g., "SECTION: Modal")
3. Locate the function using its JSDoc comment
4. Make your changes
5. Test functionality

### Adding New Features

**New CSS component:**
1. Add styles to appropriate existing module, OR
2. Create new module file in `css/modules/`
3. Import it in `css/tracker-main.css`

**New JavaScript feature:**
1. Add to appropriate section in `tracker.js`
2. Follow existing JSDoc comment style
3. Consider future extraction to dedicated module

## Benefits of This Structure

✅ **Faster Development**: Find and modify code in seconds, not minutes
✅ **Parallel Work**: Multiple developers can work on different modules without conflicts
✅ **Easier Onboarding**: New team members understand structure immediately
✅ **Maintainability**: Changes are isolated to specific files
✅ **Testing**: Can test modules independently
✅ **Performance**: Browser caches individual modules

## File Size Comparison

| File | Before | After (Modular) |
|------|--------|-----------------|
| tracker.html | 5,336 lines | 1,141 lines |
| CSS (total) | 988 lines (inline) | 1,026 lines (10 modules) |
| JavaScript (total) | 3,206 lines (inline) | 3,337 lines (1 file + future modules) |

## Next Steps

- [ ] Complete JavaScript module extraction
- [ ] Add module-level unit tests
- [ ] Create component documentation for each module
- [ ] Set up automated linting per module
- [ ] Add module dependency diagram

## Questions?

See main PR description for full refactoring details and rationale.
