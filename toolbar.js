// Board toolbar tweaks that leave more room for the custom filter chips:
//
// - compactToolbar: tucks the icon buttons (Sprint details, Sprint insights,
//   View settings, ...) into the "More board view actions" (•••) menu. They
//   stay in the DOM, invisibly stacked behind •••, so popups they open still
//   anchor next to it. When the ••• menu opens we add a menu item per icon
//   that clicks the hidden original.
// - compactSearch: shrinks "Search board" to an icon while it's empty and
//   unfocused (CSS in content.css; here we only tag the elements).
(() => {
  'use strict';

  const MORE_LABEL = 'More board view actions';
  const MORE_MENU_SELECTOR = '[role="menu"][aria-label="More actions on board view"]';
  const GROUP_CLASS = 'jcf-tuck-group';
  const TUCKED_CLASS = 'jcf-tucked';
  const MENU_CLASS = 'jcf-more-menu';
  const MENU_SECTION_CLASS = 'jcf-menu-section';

  const SEARCH_FIELD_SELECTOR = '[data-testid="filter-refinement.ui.search-field-container"]';
  const SEARCH_FIELD_CLASS = 'jcf-search-field';
  const SEARCH_SLOT_CLASS = 'jcf-search-slot';
  const COMPACT_SEARCH_CLASS = 'jcf-compact-search';
  // At most this many wrappers above the field (they hold its 160px width).
  const MAX_SEARCH_SLOT_DEPTH = 4;

  let enabled = false;
  let compactSearch = false;

  const label = (button) => button.textContent.trim();

  const findMoreButton = () =>
    [...document.querySelectorAll('button[aria-haspopup]')].find((b) => label(b) === MORE_LABEL);

  // The ••• button's wrapper is the child of the icon group that holds only it;
  // its siblings are the icons we tuck away.
  function findToolbar() {
    const more = findMoreButton();
    if (!more) return null;
    let wrapper = more;
    while (wrapper.parentElement && wrapper.parentElement.querySelectorAll('button').length === 1) {
      wrapper = wrapper.parentElement;
    }
    const group = wrapper.parentElement;
    if (!group) return null;
    return { more, wrapper, group };
  }

  // Jira renders the icons' popups (and the ••• menu itself) inside the same
  // group, so those must stay visible.
  const isPopup = (el) =>
    el.matches('[data-testid$="--container"], [role="dialog"], [role="menu"]') ||
    !!el.querySelector('[role="dialog"], [role="menu"]');

  const iconSlots = (toolbar) =>
    [...toolbar.group.children].filter((child) => child !== toolbar.wrapper && !isPopup(child));

  const tuckedButtons = (toolbar) =>
    iconSlots(toolbar)
      .flatMap((slot) => [...slot.querySelectorAll('button')])
      .filter((b) => label(b) && !b.closest('[role="menu"], [role="dialog"]'));

  function applyToolbar() {
    const toolbar = findToolbar();
    if (!enabled || !toolbar) {
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
    const menu = document.querySelector(MORE_MENU_SELECTOR);
    if (!menu || menu.querySelector(`.${MENU_SECTION_CLASS}`)) return;
    const toolbar = findToolbar();
    if (!toolbar) return;
    const sources = tuckedButtons(toolbar);
    if (!sources.length) return;

    menu.classList.add(MENU_CLASS);
    const section = document.createElement('div');
    section.setAttribute('role', 'group');
    section.className = MENU_SECTION_CLASS;
    section.append(...sources.map(buildMenuItem));

    const firstSection = menu.querySelector('[data-section]') || menu.firstElementChild;
    if (firstSection) firstSection.before(section);
    else menu.append(section);
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
