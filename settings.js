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
  };
  const MIN_FONT_SIZE = 9;
  const MAX_FONT_SIZE = 20;

  const clampFontSize = (size) =>
    Number.isFinite(size)
      ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)))
      : DEFAULTS.fontSize;

  const normalize = (raw) => ({
    expanded: raw.expanded !== false,
    fontSize: clampFontSize(Number(raw.fontSize)),
    compactToolbar: raw.compactToolbar === true,
    singleRow: raw.singleRow !== false,
    compactSearch: raw.compactSearch !== false,
  });

  globalThis.jcfSettings = {
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    clampFontSize,

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
