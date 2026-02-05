# Entry List Component - Quick Reference

## New Methods Added

### Form Submission
```javascript
setupFormHandlers()           // Initialize all form listeners
handleFeedSubmit(e)           // Feed form → API
handleSusuSubmit(e)           // Susu form → API
handlePotiSubmit(e)           // Poti form → API
handleTempSubmit(e)           // Temperature form → API
handleWeightSubmit(e)         // Weight form → API
```

### Entry Operations
```javascript
editEntry(id)                 // Open modal with pre-filled data
deleteEntry(id)               // Delete via API
confirmDelete(id)             // Confirm + delete
duplicateEntry(id)            // Copy with new timestamp
refreshEntries()              // Reload from server
```

### Touch/Swipe Gestures
```javascript
handleTouchStart(e, element)  // Start tracking
handleTouchMove(e, element)   // Track movement
handleTouchEnd(e, element)    // Complete gesture
```

### Context Menu
```javascript
showContextMenu(e, entryId)   // Display menu
handleContextMenu(e, entryId) // Right-click handler
```

## Usage Examples

### HTML Entry Card
```html
<div class="timeline-card-content"
     ontouchstart="window.entryList.handleTouchStart(event, this)"
     ontouchmove="window.entryList.handleTouchMove(event, this)"
     ontouchend="window.entryList.handleTouchEnd(event, this)"
     oncontextmenu="window.entryList.handleContextMenu(event, ${entry.id})">

  <button onclick="window.entryList.showContextMenu(event, ${entry.id})">
    Menu
  </button>
</div>
```

### Trigger Refresh
```javascript
// From external component
window.dispatchEvent(new CustomEvent('filters:changed'));
window.dispatchEvent(new CustomEvent('speech:saved'));
```

### Manual Operations
```javascript
// Edit
window.entryList.editEntry(123);

// Duplicate
window.entryList.duplicateEntry(123);

// Delete
window.entryList.confirmDelete(123);

// Refresh
await window.entryList.refreshEntries();
```

## Form Requirements

### Feed Form
```html
<form id="feed-form">
  <input type="date" id="feed-date">
  <input type="time" id="feed-time">
  <select id="feed-type">
  <input type="number" id="feed-amount">
  <textarea id="feed-notes">
</form>
```

### Susu Form
```html
<form id="susu-form">
  <input type="date" id="susu-date">
  <input type="time" id="susu-time">
  <input type="number" id="susu-count">
  <select id="susu-item-type">
  <select id="susu-color">
  <textarea id="susu-notes">
</form>
```

### Poti Form
```html
<form id="poti-form">
  <input type="date" id="poti-date">
  <input type="time" id="poti-time">
  <input type="number" id="poti-count">
  <select id="poti-color">
  <select id="poti-item-type">
  <select id="poti-consistency">
  <textarea id="poti-notes">
</form>
```

### Temperature Form
```html
<form id="temp-form">
  <input type="date" id="temp-date">
  <input type="time" id="temp-time">
  <input type="number" id="temp-value">
  <textarea id="temp-notes">
</form>
```

### Weight Form
```html
<form id="weight-form">
  <input type="date" id="weight-date">
  <input type="time" id="weight-time">
  <input type="number" id="weight-value">
  <textarea id="weight-notes">
</form>
```

## CSS Required

```css
/* Context Menu */
.context-menu { position: fixed; z-index: 1000; }
.context-menu-item { cursor: pointer; }
.context-menu-item.destructive { color: red; }
.context-menu-overlay { position: fixed; inset: 0; z-index: 999; }

/* Swipe Support */
.timeline-card-content {
  transition: transform 0.3s;
  touch-action: pan-y;
  user-select: none;
}
```

## Event Flow

### Create Entry
```
User fills form
  → handleFeedSubmit(e)
    → _getTimestampFromInputs('feed')
    → _saveEntry(data, 'feed')
      → api.createEntry(data)
      → showToast('success')
      → modals.close('feed')
      → refreshEntries()
        → api.fetchEntries()
        → state.setState()
        → render()
```

### Edit Entry
```
User clicks entry menu
  → showContextMenu(e, id)
    → User clicks "Edit"
      → editEntry(id)
        → Find entry by id
        → modals.open('feed', entry)
          → Form pre-filled
          → User edits + submits
            → _saveEntry(data, 'feed') [with editingEntry]
              → api.updateEntry(id, data)
              → refreshEntries()
```

### Delete Entry
```
User clicks entry menu
  → showContextMenu(e, id)
    → User clicks "Delete"
      → confirmDelete(id)
        → confirm() dialog
          → deleteEntry(id)
            → api.deleteEntry(id)
            → showToast('deleted')
            → refreshEntries()
```

### Duplicate Entry
```
User clicks entry menu
  → showContextMenu(e, id)
    → User clicks "Duplicate"
      → duplicateEntry(id)
        → Find entry
        → Copy data
        → Set new timestamp
        → api.createEntry(newEntry)
        → refreshEntries()
```

### Swipe Gesture
```
User touches entry
  → handleTouchStart(e, element)
    → Store start position
    → Close other swipes
      → User moves finger left
        → handleTouchMove(e, element)
          → Calculate diffX
          → Apply transform
            → User lifts finger
              → handleTouchEnd(e, element)
                → Check threshold
                → Snap to open/closed
```

## State Flow

```javascript
// Initial State
{
  entries: [],
  pagination: { currentPage: 1, hasMore: true },
  ui: { loading: false, editingEntry: null },
  filters: { types: Set(['feed', 'susu', ...]) }
}

// After Create
{
  entries: [newEntry, ...oldEntries],
  pagination: { currentPage: 1, hasMore: true },
  ui: { loading: false, editingEntry: null }
}

// During Edit
{
  ui: { editingEntry: { id: 123, ... } }
}

// After Update
{
  entries: [updatedEntry, ...otherEntries],
  ui: { editingEntry: null }
}
```

## Debugging

```javascript
// Check if component loaded
console.log(window.entryList);

// Check state
console.log(window.appState.getState());

// Test API
await window.appAPI.fetchEntries({page: 1, limit: 20});

// Trigger refresh manually
window.entryList.refreshEntries();

// Check form binding
window.entryList.setupFormHandlers();
```

## Common Patterns

### Add New Form Type
```javascript
// 1. Add handler method
async handleNewTypeSubmit(e) {
  e.preventDefault();
  const data = { /* extract fields */ };
  await this._saveEntry(data, 'newtype');
}

// 2. Register in setupFormHandlers
const form = document.getElementById('newtype-form');
if (form) {
  form.addEventListener('submit', (e) => this.handleNewTypeSubmit(e));
}

// 3. Add to editEntry logic
if (entry.newtype_field) {
  modals.open('newtype', entry);
}
```

### Custom Refresh Trigger
```javascript
// Dispatch custom event
window.dispatchEvent(new CustomEvent('custom:refresh'));

// Listen in _setupEventListeners
window.addEventListener('custom:refresh', () => {
  this.refreshEntries();
});
```

### Add to Context Menu
```javascript
menu.innerHTML = `
  <button class="context-menu-item" data-action="edit">Edit</button>
  <button class="context-menu-item" data-action="duplicate">Duplicate</button>
  <button class="context-menu-item" data-action="custom">Custom Action</button>
  <button class="context-menu-item destructive" data-action="delete">Delete</button>
`;

// Handle in showContextMenu
if (action === 'custom') {
  this.customAction(id);
}
```

## Files Reference

```
html/
├── js/
│   ├── components/
│   │   └── entry-list.js        ← Enhanced component
│   └── styles/
│       └── entry-list.css       ← Standalone styles
├── tracker-test.html            ← Updated with styles
├── ENTRY_LIST_ENHANCEMENTS.md   ← Full documentation
└── IMPLEMENTATION_SUMMARY.md    ← Summary & stats
```

## Keyboard Shortcuts (Future)

```javascript
// Potential additions
document.addEventListener('keydown', (e) => {
  if (e.key === 'e') this.editEntry(selectedId);
  if (e.key === 'd') this.duplicateEntry(selectedId);
  if (e.key === 'Delete') this.confirmDelete(selectedId);
});
```

---

**Quick Stats:**
- 19 new methods
- 488 lines added
- 5 form handlers
- 4 entry operations
- 4 touch handlers
- 3 context menu methods
