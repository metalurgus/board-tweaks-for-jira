// filterShortcuts: number keys toggle the board's filters. 1-9 toggle the
// first nine ("|" separators don't count), 0 turns all of them off. Keys are
// matched by position (event.code), so this works with any keyboard layout.
(() => {
  'use strict';

  // Typing somewhere, or a dialog (e.g. an open issue) has the keyboard.
  const BUSY_SELECTOR =
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="dialog"], [role="menu"]';

  let enabled = false;

  function onKeydown(e) {
    if (!enabled || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1];
    if (digit === undefined) return;
    if (e.target instanceof Element && e.target.closest(BUSY_SELECTOR)) return;

    const states = jcfFilters.states();
    if (!states.length) return;
    const n = Number(digit);
    if (n === 0) {
      jcfFilters.setSelection(() => false);
    } else {
      const index = states
        .map((filter, i) => (filter.separator ? -1 : i))
        .filter((i) => i !== -1)[n - 1];
      if (index === undefined) return;
      jcfFilters.toggle(index);
    }
    e.preventDefault();
    e.stopPropagation();
  }

  jcfSettings.load().then((settings) => {
    enabled = settings.filterShortcuts;
  });
  jcfSettings.onChange((settings) => {
    enabled = settings.filterShortcuts;
  });
  // Capture: ahead of Jira's own single-key shortcuts.
  window.addEventListener('keydown', onKeydown, { capture: true });
})();
