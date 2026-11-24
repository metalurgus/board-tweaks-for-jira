// A small menu that opens under one of our toolbar buttons, styled after
// Jira's own (content.css, .jcf-popover). Used for the filter dropdown and
// the saved filter sets.
//
// It lives in <body> with fixed positioning, so the toolbar's overflow
// (sideways scrolling in single-row mode) can't clip it.
(() => {
  'use strict';

  const ITEM_SELECTOR = '.jcf-popover-item:not(:disabled)';

  // render(menu) fills the menu; it runs on open and on every refresh().
  function create({ button, label, render }) {
    const menu = document.createElement('div');
    menu.className = 'jcf-popover';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', label);
    menu.tabIndex = -1;
    menu.hidden = true;
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');

    let abort = null;
    let following = 0; // requestAnimationFrame id while open

    function place() {
      const rect = button.getBoundingClientRect();
      menu.style.top = `${Math.round(rect.bottom + 4)}px`;
      // Keep it on screen when the button sits near the right edge.
      const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8);
      menu.style.left = `${Math.round(Math.max(8, left))}px`;
    }

    function open({ focus = false } = {}) {
      if (!menu.hidden) return;
      document.body.append(menu);
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      render(menu);
      place();
      if (focus) menu.querySelector(ITEM_SELECTOR)?.focus();
      // Follow the button: Jira adds and removes toolbar buttons (e.g. "Clear
      // filters") as filters change, which moves ours.
      const follow = () => {
        place();
        following = requestAnimationFrame(follow);
      };
      following = requestAnimationFrame(follow);

      abort = new AbortController();
      const on = (target, type, fn, options = {}) =>
        target.addEventListener(type, fn, { ...options, signal: abort.signal });
      on(document, 'pointerdown', (e) => {
        if (!menu.contains(e.target) && !button.contains(e.target)) close();
      }, { capture: true });
      on(document, 'keydown', onKeydown, { capture: true });
      on(window, 'resize', close);
      on(window, 'blur', close);
    }

    function close({ focusButton = false } = {}) {
      if (menu.hidden) return;
      abort?.abort();
      cancelAnimationFrame(following);
      menu.hidden = true;
      menu.remove();
      button.setAttribute('aria-expanded', 'false');
      if (focusButton) button.focus();
    }

    // Escape closes; arrows move between items (the page's own shortcuts
    // don't see these keys while the menu is open).
    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close({ focusButton: true });
        return;
      }
      if (!menu.contains(document.activeElement) && document.activeElement !== button) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      e.stopPropagation();
      const items = [...menu.querySelectorAll(ITEM_SELECTOR)];
      const at = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
      items[(next + items.length) % items.length]?.focus();
    }

    function refresh() {
      if (menu.hidden) return;
      // Keep focus on the same item across the re-render.
      const items = [...menu.querySelectorAll(ITEM_SELECTOR)];
      const focused = items.indexOf(document.activeElement);
      render(menu);
      place();
      if (focused !== -1) menu.querySelectorAll(ITEM_SELECTOR)[focused]?.focus();
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu.hidden) open({ focus: e.detail === 0 }); // detail 0: keyboard
      else close();
    });

    return { menu, open, close, refresh, isOpen: () => !menu.hidden };
  }

  // A menu row: a button with optional check state and trailing action.
  function item({ text, checked, disabled = false, onClick, title }) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'jcf-popover-item';
    el.tabIndex = -1;
    el.disabled = disabled;
    if (title) el.title = title;
    if (checked === undefined) {
      el.setAttribute('role', 'menuitem');
    } else {
      el.setAttribute('role', 'menuitemcheckbox');
      el.setAttribute('aria-checked', String(checked));
      const box = document.createElement('span');
      box.className = 'jcf-popover-check';
      box.setAttribute('aria-hidden', 'true');
      el.append(box);
    }
    const label = document.createElement('span');
    label.className = 'jcf-popover-text';
    label.textContent = text;
    el.append(label);
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(e);
    });
    return el;
  }

  function separator() {
    const el = document.createElement('div');
    el.className = 'jcf-popover-sep';
    el.setAttribute('role', 'separator');
    return el;
  }

  function heading(text) {
    const el = document.createElement('div');
    el.className = 'jcf-popover-heading';
    el.textContent = text;
    return el;
  }

  globalThis.jcfPopover = { create, item, separator, heading };
})();
