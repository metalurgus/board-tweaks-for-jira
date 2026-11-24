// Board layout tweaks (CSS in content.css, keyed off <html>):
// - compactCards: tighter cards so more fit on screen.
// - columnWidth: an exact column width. Jira's own sizing (the default) gives
//   columns at least 200px and stretches them to fill the board, so below
//   that point a smaller minimum would change nothing; an exact width always
//   does, leaving space to the right when the columns fit.
(() => {
  'use strict';

  const COMPACT_CARDS_CLASS = 'jcf-compact-cards';
  const COLUMN_WIDTH_CLASS = 'jcf-column-width';
  const CELL_SELECTOR = '[data-testid="board.content.cell"]';

  function apply({ compactCards, columnWidth }) {
    const root = document.documentElement;
    root.classList.toggle(COMPACT_CARDS_CLASS, compactCards);
    root.classList.toggle(COLUMN_WIDTH_CLASS, columnWidth > 0);
    if (columnWidth > 0) root.style.setProperty('--jcf-column-width', `${columnWidth}px`);
    else root.style.removeProperty('--jcf-column-width');
  }

  // The popup steps from the columns' current width when leaving Jira's sizing.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'jcf-get-column-width') return;
    const column = document.querySelector(CELL_SELECTOR)?.parentElement;
    sendResponse({ width: column ? Math.round(column.getBoundingClientRect().width) : null });
  });

  jcfSettings.load().then(apply);
  jcfSettings.onChange(apply);
})();
