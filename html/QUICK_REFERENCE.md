# Quick Reference: Where to Make Changes

## I want to change...

### Visual Styling (CSS)

| Feature | Edit This File |
|---------|---------------|
| Body background color, fonts | `css/modules/base.css` |
| Timeline vertical line, spacing | `css/modules/timeline.css` |
| Voice recording button, waveform | `css/modules/speech-recording.css` |
| Swipe-to-delete actions | `css/modules/swipe-actions.css` |
| Modal dialogs, overlays | `css/modules/modals.css` |
| Filter chips, tabs, navigation | `css/modules/filters.css` |
| Dashboard cards, metrics display | `css/modules/dashboard.css` |
| Shake, slide, fade animations | `css/modules/animations.css` |
| Mobile-only styles, touch optimization | `css/modules/mobile.css` |
| Breakpoints, screen size adjustments | `css/modules/responsive.css` |

### JavaScript Functionality

| Feature | Search For (in js/tracker.js) |
|---------|-------------------------------|
| API endpoints | `SECTION: API Configuration` |
| App state variables | `SECTION: State Management` |
| Speech recording state | `SECTION: Speech Recording State` |
| DOM element selectors | `SECTION: DOM Element References` |
| DateTime helpers | `getCurrentDateTime`, `parseDateTime` |
| Diaper notifications | `sendDiaperNappyNotification` |
| Modal open/close | `openModal`, `closeModal` |
| Entry CRUD | `fetchEntries`, `addEntry`, `updateEntry`, `deleteEntry` |
| Statistics | `updateStats` |
| Charts | `initializeChart`, `updateChart` |
| Long press delete | `SECTION: Long Press` |

## Common Tasks

### Add a new color to the dashboard
1. Open `css/modules/dashboard.css`
2. Find the `.dashboard-grid` or metric card styles
3. Add your new color classes

### Change how the diaper timer looks
1. Open `css/modules/dashboard.css` 
2. Search for `diaper-timer`
3. Modify the card styling

### Modify speech recording button behavior
1. Open `js/tracker.js`
2. Search for `startSpeechRecording` function
3. Make your changes with existing JSDoc comments as guide

### Update modal dialog layout
1. Open `css/modules/modals.css`
2. Find `.modal-content` and related classes
3. Adjust padding, width, or animations

### Change timeline entry appearance
1. Open `css/modules/timeline.css`
2. Modify `.timeline-item` or `.timeline-container` styles

### Add new entry type
1. Edit `js/tracker.js` → Search for `typeFilters`
2. Add your type to the Set
3. Add modal HTML in `tracker.html`
4. Add form handlers following existing patterns

## File Organization

```
html/
├── tracker.html              # Main HTML structure
├── css/
│   ├── tracker-main.css      # Import file (reference in HTML)
│   └── modules/              # Individual CSS modules
│       ├── base.css
│       ├── timeline.css
│       ├── speech-recording.css
│       ├── swipe-actions.css
│       ├── modals.css
│       ├── filters.css
│       ├── dashboard.css
│       ├── animations.css
│       ├── mobile.css
│       └── responsive.css
└── js/
    ├── tracker.js            # Main JavaScript (reference in HTML)
    └── modules/              # Future: modular JavaScript
        ├── config.js         # API & constants (created)
        └── state.js          # State variables (created)
```

## Tips

✅ **CSS Changes**: Edit the specific module file, refresh browser
✅ **JS Changes**: Use browser DevTools to test before editing
✅ **Search**: Use Ctrl+F / Cmd+F to find functions quickly
✅ **Comments**: All functions have JSDoc comments explaining purpose
✅ **Sections**: Code is organized in sections with clear headers

## Need Help?

1. Check `MODULAR_STRUCTURE.md` for full documentation
2. Look at JSDoc comments for function parameters
3. Follow existing code patterns
4. Test changes incrementally
