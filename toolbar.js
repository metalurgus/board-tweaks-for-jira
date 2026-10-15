// Board toolbar tweaks that leave more room for the custom filter chips:
//
// - compactToolbar: tucks the icon buttons (Sprint details, Sprint insights,
//   View settings, ...) into the "More board view actions" (•••) menu. They
//   stay in the DOM, invisibly stacked behind •••, so popups they open still
//   anchor next to it. When the ••• menu opens we add a menu item per icon,
//   with the hidden original laid invisibly over it to take the click.
// - compactSearch: shrinks "Search board" to an icon while it's empty and
//   unfocused (CSS in content.css; here we only tag the elements).
(() => {
  'use strict';

  // Popups Jira renders inside the toolbar: the ••• menu and the icons' dialogs.
  const POPUP_SELECTOR = '[data-testid$="--container"], [role="dialog"], [role="menu"]';
  // At most this many levels from the search field up to the toolbar row.
  const MAX_TOOLBAR_DEPTH = 10;
  const GROUP_CLASS = 'jcf-tuck-group';
  const TUCKED_CLASS = 'jcf-tucked';
  const MENU_CLASS = 'jcf-more-menu';
  const MENU_SECTION_CLASS = 'jcf-menu-section';
  const OVERLAY_CLASS = 'jcf-overlay'; // a tucked button laid over its menu item
  const HOVER_CLASS = 'jcf-hover'; // on a menu item while its overlay is hovered
  const MAX_PRESS_MS = 1000; // longest a press keeps the overlay after the menu closes

  const SEARCH_FIELD_SELECTOR = '[data-testid="filter-refinement.ui.search-field-container"]';
  const SEARCH_FIELD_CLASS = 'jcf-search-field';
  const SEARCH_SLOT_CLASS = 'jcf-search-slot';
  const COMPACT_SEARCH_CLASS = 'jcf-compact-search';
  // At most this many wrappers above the field (they hold its 160px width).
  const MAX_SEARCH_SLOT_DEPTH = 4;

  let enabled = false;
  let compactSearch = false;

  const label = (button) => button.textContent.trim();

  // The toolbar row starts with the filter controls (search field first) and
  // ends with the group of icons, whose last button is •••. Found by structure
  // rather than by label, since Jira translates those. The ••• button's
  // wrapper is its ancestor in the group; its siblings are the icons we tuck away.
  function findToolbar() {
    const search = document.querySelector(SEARCH_FIELD_SELECTOR);
    let row = search?.parentElement;
    for (let depth = 0; row && depth < MAX_TOOLBAR_DEPTH; depth++, row = row.parentElement) {
      const group = row.lastElementChild;
      if (group.contains(search)) continue;
      const buttons = [...group.querySelectorAll('button')].filter((b) => {
        const popup = b.closest(POPUP_SELECTOR);
        return !popup || !group.contains(popup);
      });
      const more = buttons.at(-1);
      if (buttons.length < 2 || more.getAttribute('aria-haspopup') !== 'true') continue;
      let wrapper = more;
      while (wrapper.parentElement !== group) wrapper = wrapper.parentElement;
      return { more, wrapper, group };
    }
    return null;
  }

  const findMoreButton = () => findToolbar()?.more;

  // The ••• button points at its open menu's container.
  function findMoreMenu(more) {
    const id = more.getAttribute('aria-controls');
    const container = id && document.getElementById(id);
    if (!container) return null;
    return container.matches('[role="menu"]') ? container : container.querySelector('[role="menu"]');
  }

  // Jira renders the icons' popups (and the ••• menu itself) inside the same
  // group, so those must stay visible.
  const isPopup = (el) => el.matches(POPUP_SELECTOR) || !!el.querySelector('[role="dialog"], [role="menu"]');

  const iconSlots = (toolbar) =>
    [...toolbar.group.children].filter((child) => child !== toolbar.wrapper && !isPopup(child));

  const tuckedButtons = (toolbar) =>
    iconSlots(toolbar)
      .flatMap((slot) => [...slot.querySelectorAll('button')])
      .filter((b) => label(b) && !b.closest('[role="menu"], [role="dialog"]'));

  function applyToolbar() {
    const toolbar = findToolbar();
    if (!enabled || !toolbar) {
      stopOverlay();
      document.querySelectorAll(`.${TUCKED_CLASS}`).forEach((el) => el.classList.remove(TUCKED_CLASS));
      document.querySelectorAll(`.${GROUP_CLASS}`).forEach((el) => el.classList.remove(GROUP_CLASS));
      return;
    }
    toolbar.group.classList.add(GROUP_CLASS);
    const slots = iconSlots(toolbar);
    for (const child of toolbar.group.children) {
      child.classList.toggle(TUCKED_CLASS, slots.includes(child));
    }
  }

  // --- compact search ------------------------------------------------------------

  // Tags the search field and the wrappers that hold its width (those that
  // contain no other input; the next one up also holds the assignee avatars).
  function applySearch() {
    document.documentElement.classList.toggle(COMPACT_SEARCH_CLASS, compactSearch);
    const field = document.querySelector(SEARCH_FIELD_SELECTOR);
    if (!compactSearch || !field || field.classList.contains(SEARCH_FIELD_CLASS)) return;
    field.classList.add(SEARCH_FIELD_CLASS);
    let slot = field.parentElement;
    for (let depth = 0; slot && depth < MAX_SEARCH_SLOT_DEPTH; depth++) {
      if (slot.querySelectorAll('input').length !== 1) break;
      slot.classList.add(SEARCH_SLOT_CLASS);
      slot = slot.parentElement;
    }
  }

  // --- ••• menu ----------------------------------------------------------------

  function closeMoreMenu() {
    const more = findMoreButton();
    if (more?.getAttribute('aria-expanded') === 'true') {
      more.click();
    } else {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })
      );
    }
  }

  function pressTucked(name) {
    closeMoreMenu();
    // Let the menu finish closing first, or the popup the icon opens can be
    // dismissed by the menu's own outside-click handling.
    setTimeout(() => {
      const toolbar = findToolbar();
      const button = toolbar && tuckedButtons(toolbar).find((b) => label(b) === name);
      button?.click();
    }, 50);
  }

  // --- real clicks on tucked buttons ----------------------------------------------

  // Jira doesn't treat a scripted click like a real one everywhere: opened
  // with button.click(), the View settings panel stays empty the first time.
  // So while the ••• menu is open, each tucked button lies invisibly on top of
  // its menu item and takes the mouse click itself. The item's own click
  // handler (pressTucked) is left for keyboard use.
  let overlay = null; // { menu, group, pairs: [{ item, slot }], abort, pressing }

  function startOverlay(menu, group, pairs) {
    stopOverlay();
    if (!pairs.length) return;
    const abort = new AbortController();
    const current = { menu, group, pairs, abort, pressing: false };
    overlay = current;
    // The menu closes on pointerdown outside it; keep the buttons in place until
    // the click that follows has landed. Capped, in case the release is never
    // seen (e.g. the mouse is let go outside the window).
    const release = () =>
      setTimeout(() => {
        current.pressing = false;
        checkOverlay();
      });
    for (const { item, slot } of pairs) {
      slot.classList.add(OVERLAY_CLASS);
      const on = (type, fn) => slot.addEventListener(type, fn, { signal: abort.signal });
      on('pointerenter', () => item.classList.add(HOVER_CLASS));
      on('pointerleave', () => item.classList.remove(HOVER_CLASS));
      on('pointerdown', () => {
        current.pressing = true;
        setTimeout(release, MAX_PRESS_MS);
      });
    }
    window.addEventListener('pointerup', release, { capture: true, signal: abort.signal });
    window.addEventListener('pointercancel', release, { capture: true, signal: abort.signal });
    positionOverlay(current);
  }

  // Follows the menu every frame (it's positioned, and can move, after we fill it).
  function positionOverlay(current) {
    if (overlay !== current) return;
    const { menu, group, pairs } = current;
    if (menu.isConnected) {
      const origin = group.getBoundingClientRect();
      for (const { item, slot } of pairs) {
        const rect = item.getBoundingClientRect();
        slot.style.setProperty('--jcf-overlay-top', `${rect.top - origin.top}px`);
        slot.style.setProperty('--jcf-overlay-left', `${rect.left - origin.left}px`);
        slot.style.setProperty('--jcf-overlay-width', `${rect.width}px`);
        slot.style.setProperty('--jcf-overlay-height', `${rect.height}px`);
      }
    }
    requestAnimationFrame(() => positionOverlay(current));
  }

  // Puts the buttons back once the menu is gone. Called on DOM changes and on
  // release rather than from the frame loop, which Chrome can slow to a crawl
  // in a window that isn't visible.
  function checkOverlay() {
    if (overlay && !overlay.pressing && !overlay.menu.isConnected) stopOverlay();
  }

  function stopOverlay() {
    if (!overlay) return;
    overlay.abort.abort();
    for (const { item, slot } of overlay.pairs) {
      item.classList.remove(HOVER_CLASS);
      slot.classList.remove(OVERLAY_CLASS);
      for (const prop of ['top', 'left', 'width', 'height']) slot.style.removeProperty(`--jcf-overlay-${prop}`);
    }
    overlay = null;
  }

  // Styled in content.css to match Jira's menu items. (Copying Jira's own item
  // markup isn't reliable: the menu often renders its items only after a
  // network round trip.)
  function buildMenuItem(source) {
    const name = label(source);
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.className = 'jcf-menu-item';
    item.tabIndex = -1;

    const icon = source.querySelector('svg');
    if (icon) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'jcf-menu-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.append(icon.cloneNode(true));
      item.append(iconWrap);
    }
    const title = document.createElement('span');
    title.textContent = name;
    item.append(title);

    const disabled = source.disabled || source.getAttribute('aria-disabled') === 'true';
    item.disabled = disabled;
    item.setAttribute('aria-disabled', String(disabled));
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) pressTucked(name);
    });
    return item;
  }

  function injectMenuItems() {
    if (!enabled) return;
    const toolbar = findToolbar();
    const menu = toolbar && findMoreMenu(toolbar.more);
    if (!menu || menu.querySelector(`.${MENU_SECTION_CLASS}`)) return;
    const sources = tuckedButtons(toolbar);
    if (!sources.length) return;

    menu.classList.add(MENU_CLASS);
    const section = document.createElement('div');
    section.setAttribute('role', 'group');
    section.className = MENU_SECTION_CLASS;
    const slots = iconSlots(toolbar);
    const pairs = [];
    section.append(
      ...sources.map((source) => {
        const item = buildMenuItem(source);
        const slot = slots.find((s) => s.contains(source));
        // Only a slot holding just this button can stand in for the item.
        if (!item.disabled && slot?.querySelectorAll('button').length === 1) pairs.push({ item, slot });
        return item;
      })
    );

    const firstSection = menu.querySelector('[data-section]') || menu.firstElementChild;
    if (firstSection) firstSection.before(section);
    else menu.append(section);
    startOverlay(menu, toolbar.group, pairs);
  }

  // --- wiring ------------------------------------------------------------------

  async function start() {
    ({ compactToolbar: enabled, compactSearch } = await jcfSettings.load());
    jcfSettings.onChange((settings) => {
      ({ compactToolbar: enabled, compactSearch } = settings);
      applyToolbar();
      applySearch();
    });

    let applyScheduled = false;
    new MutationObserver(() => {
      checkOverlay();
      // Fill the menu straight away so its items don't pop in late.
      injectMenuItems();
      if (applyScheduled) return;
      applyScheduled = true;
      setTimeout(() => {
        applyScheduled = false;
        applyToolbar();
        applySearch();
      }, 100);
    }).observe(document.body, { childList: true, subtree: true });

    applyToolbar();
    applySearch();
  }

  start();
})();
