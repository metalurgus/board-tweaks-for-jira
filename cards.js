// compactCards: tighter board cards so more fit on screen (CSS in
// content.css, keyed off a class on <html>).
(() => {
  'use strict';

  const COMPACT_CARDS_CLASS = 'jcf-compact-cards';

  const apply = ({ compactCards }) =>
    document.documentElement.classList.toggle(COMPACT_CARDS_CLASS, compactCards);

  jcfSettings.load().then(apply);
  jcfSettings.onChange(apply);
})();
