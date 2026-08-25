(() => {
  'use strict';

  function iconButton(id, title, label, icon) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.className = 'btn btn-icon';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = `<span aria-hidden="true">${icon}</span><span class="action-label sr-only">${label}</span>`;
    return button;
  }

  function upgradeHeader() {
    const row = document.querySelector('.header-row');
    const logo = row?.querySelector('.logo');
    const status = document.getElementById('connectionStatus');
    if (!row || !logo || row.dataset.upgraded === 'true') return;
    row.dataset.upgraded = 'true';

    const brand = document.createElement('div');
    brand.className = 'brand-lockup';
    const mark = document.createElement('div');
    mark.className = 'logo-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '◈';

    const copy = document.createElement('div');
    copy.className = 'logo-copy';
    logo.innerHTML = '<span>INTEL TERMINAL</span><span class="logo-3000">3000</span>';
    const subtitle = document.createElement('div');
    subtitle.className = 'logo-subtitle';
    subtitle.textContent = 'Open-source intelligence workspace';
    copy.append(logo, subtitle);
    brand.append(mark, copy);

    const meta = document.createElement('div');
    meta.className = 'header-meta';
    if (status) {
      const text = status.childNodes[status.childNodes.length - 1];
      if (text?.nodeType === Node.TEXT_NODE) text.remove();
      const statusCopy = document.createElement('span');
      statusCopy.className = 'status-copy';
      statusCopy.textContent = 'LIVE';
      status.appendChild(statusCopy);
      meta.appendChild(status);
    }
    const clock = document.createElement('time');
    clock.id = 'utcClock';
    clock.className = 'clock-chip';
    clock.textContent = '--:--:-- Z';
    meta.appendChild(clock);

    const actions = document.createElement('div');
    actions.className = 'header-actions';
    const command = iconButton('commandPaletteTrigger', 'Open command palette', 'Commands', '⌘');
    command.classList.add('command-trigger');
    const density = iconButton('densityToggle', 'Toggle compact density', 'Compact', '≡');

    const existing = [...row.children].filter((node) => node !== logo && node !== status);
    existing.forEach((node) => actions.appendChild(node));
    actions.prepend(density, command);

    row.replaceChildren(brand, meta, actions);
  }

  function addWorkspaceHeading() {
    const nav = document.getElementById('pageNav');
    const dashboard = document.getElementById('dashboardContainer');
    if (!nav || !dashboard || document.getElementById('workspaceTitle')) return;
    const heading = document.createElement('section');
    heading.className = 'workspace-heading';
    heading.innerHTML = '<div><span class="workspace-kicker">Active workspace</span><h2 id="workspaceTitle">Command Center</h2></div><div class="workspace-hint">Ctrl/⌘ K commands · / focus filter · Shift R refresh</div>';
    dashboard.parentNode.insertBefore(heading, dashboard);
  }

  function init() {
    upgradeHeader();
    addWorkspaceHeading();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
