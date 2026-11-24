// Settings shared by the popup and the content script, kept in
// chrome.storage.sync so they follow you across Chrome profiles you sign into.
(() => {
  'use strict';

  const DEFAULTS = {
    expanded: true,
    fontSize: 14,
    compactToolbar: false,
    singleRow: true,
    compactSearch: true,
    compactCards: false,
    filterShortcuts: false,
    tintCards: false,
    columnWidth: 0, // 0: Jira's own sizing (columns stretch to fill the board)
  };
  const MIN_FONT_SIZE = 9;
  const MAX_FONT_SIZE = 20;
  const MIN_COLUMN_WIDTH = 120;
  const MAX_COLUMN_WIDTH = 480;
  const COLUMN_WIDTH_STEP = 10;

  const clampFontSize = (size) =>
    Number.isFinite(size)
      ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)))
      : DEFAULTS.fontSize;

  // An exact width in px, or 0 for Jira's own sizing.
  const clampColumnWidth = (width) =>
    Number.isFinite(width) && width > 0
      ? Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)))
      : 0;

  const normalize = (raw) => ({
    expanded: raw.expanded !== false,
    fontSize: clampFontSize(Number(raw.fontSize)),
    compactToolbar: raw.compactToolbar === true,
    singleRow: raw.singleRow !== false,
    compactSearch: raw.compactSearch !== false,
    compactCards: raw.compactCards === true,
    filterShortcuts: raw.filterShortcuts === true,
    tintCards: raw.tintCards === true,
    columnWidth: clampColumnWidth(Number(raw.columnWidth)),
  });

  globalThis.jcfSettings = {
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    clampFontSize,
    MIN_COLUMN_WIDTH,
    MAX_COLUMN_WIDTH,
    COLUMN_WIDTH_STEP,
    clampColumnWidth,

    async load() {
      return normalize(await chrome.storage.sync.get(DEFAULTS));
    },

    save(changes) {
      return chrome.storage.sync.set(changes);
    },

    // Calls fn(settings) whenever the stored settings change.
    onChange(fn) {
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === 'sync' && Object.keys(DEFAULTS).some((key) => key in changes)) {
          fn(await this.load());
        }
      });
    },
  };
})();
