// Saved filter sets: a bookmark button in our toolbar slot (content.js) opens
// a menu to apply a saved combination of filters in one click, save the
// current one, or clear all filters. Sets are kept per board in
// chrome.storage.sync and remember filters by name.
(() => {
  'use strict';

  const STORAGE_PREFIX = 'presets:';
  const MAX_PRESETS = 20;
  const BOOKMARK_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h8A1.5 1.5 0 0 1 13.5 3v11.2a.6.6 0 0 1-.95.49L8 11.5l-4.55 3.19a.6.6 0 0 1-.95-.49V3A1.5 1.5 0 0 1 4 1.5zm0 1.5v9.9l3.43-2.4a1 1 0 0 1 1.14 0L12 12.9V3H4z"/></svg>';

  const { item, separator, heading } = jcfPopover;

  let presets = []; // [{ name, filters: [names] }]
  let boardKey = null;
  let saving = false; // the menu shows the name field instead of "Save…"
  let button = null;
  let popover = null;

  const storageKey = () => STORAGE_PREFIX + boardKey;

  async function loadPresets() {
    boardKey = jcfFilters.boardKey();
    if (!boardKey) {
      presets = [];
      return;
    }
    const stored = (await chrome.storage.sync.get(storageKey()))[storageKey()];
    presets = Array.isArray(stored) ? stored : [];
    popover?.refresh();
  }

  function savePresets() {
    return chrome.storage.sync.set({ [storageKey()]: presets });
  }

  const selectedNames = () =>
    jcfFilters
      .states()
      .filter((f) => f.selected && !f.separator)
      .map((f) => f.name);

  const sameSet = (a, b) => a.length === b.length && a.every((name) => b.includes(name));

  async function apply(preset) {
    popover.close();
    await jcfFilters.setSelection((name) => preset.filters.includes(name));
  }

  function remove(preset) {
    presets = presets.filter((p) => p !== preset);
    savePresets();
    popover.refresh();
  }

  function saveCurrent(name) {
    const filters = selectedNames();
    if (!filters.length) return;
    const existing = presets.find((p) => p.name === name);
    if (existing) existing.filters = filters;
    else presets = [...presets, { name, filters }].slice(-MAX_PRESETS);
    savePresets();
    saving = false;
    popover.refresh();
  }

  function render(menu) {
    const current = selectedNames();
    const rows = [heading('Saved filter sets')];

    if (!presets.length) {
      const empty = document.createElement('div');
      empty.className = 'jcf-popover-note';
      empty.textContent = 'Save the filters you have on, to turn them all back on in one click later.';
      rows.push(empty);
    }
    for (const preset of presets) {
      const row = document.createElement('div');
      row.className = 'jcf-popover-row';
      const entry = item({
        text: preset.name,
        checked: current.length > 0 && sameSet(preset.filters, current),
        title: preset.filters.join(', '),
        onClick: () => apply(preset),
      });
      entry.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          remove(preset);
        }
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'jcf-popover-action';
      del.tabIndex = -1;
      del.title = `Delete "${preset.name}"`;
      del.setAttribute('aria-label', `Delete ${preset.name}`);
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        remove(preset);
      });
      row.append(entry, del);
      rows.push(row);
    }

    rows.push(separator());
    if (saving) {
      rows.push(nameField(current));
    } else {
      rows.push(
        item({
          text: 'Save current filters…',
          disabled: !current.length,
          onClick: () => {
            saving = true;
            popover.refresh();
            menu.querySelector('input')?.focus();
          },
        })
      );
    }
    rows.push(
      item({
        text: 'Clear all filters',
        disabled: !current.length,
        onClick: () => {
          popover.close();
          jcfFilters.setSelection(() => false);
        },
      })
    );
    menu.replaceChildren(...rows);
  }

  // Enter saves (an existing name is overwritten), Escape closes the menu.
  function nameField(current) {
    const form = document.createElement('form');
    form.className = 'jcf-popover-form';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 60;
    input.placeholder = current.join(' + ');
    input.setAttribute('aria-label', 'Name for this filter set');
    const ok = document.createElement('button');
    ok.type = 'submit';
    ok.className = 'jcf-tool-button';
    ok.textContent = 'Save';
    form.append(input, ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCurrent(input.value.trim() || input.placeholder);
    });
    // Keep the page's keyboard shortcuts out of the name field.
    input.addEventListener('keydown', (e) => e.stopPropagation());
    return form;
  }

  // Our toolbar slot can be re-created by content.js; put the button back.
  function placeButton() {
    const slot = jcfFilters.controls();
    if (!slot) return;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'jcf-tool-button jcf-icon-button jcf-presets-button';
      button.title = 'Saved filter sets';
      button.setAttribute('aria-label', 'Saved filter sets');
      button.innerHTML = BOOKMARK_ICON;
      popover = jcfPopover.create({
        button,
        label: 'Saved filter sets',
        render: (menu) => render(menu),
      });
      button.addEventListener('click', () => {
        saving = false;
      }, { capture: true });
    }
    if (button.parentElement !== slot) slot.append(button);
  }

  jcfFilters.onChange(() => {
    if (jcfFilters.boardKey() !== boardKey) loadPresets();
    placeButton();
    popover?.refresh();
  });
  jcfFilters.onControls(placeButton);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && boardKey && storageKey() in changes) loadPresets();
  });

  loadPresets();
})();
