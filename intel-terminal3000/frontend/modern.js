/* Intel Terminal 3000 — non-invasive workspace enhancements */
(() => {
    'use strict';

    const STORAGE_KEYS = {
        density: 'intel-terminal-density',
    };

    const pageCommands = [
        { id: 'page-command-center', icon: '⌂', title: 'Command Center', hint: 'Open the primary intelligence dashboard', run: () => callGlobal('switchPage', 'command-center') },
        { id: 'page-aviation', icon: '✈', title: 'Aviation', hint: 'Open aircraft and ADS-B intelligence', run: () => callGlobal('switchPage', 'aviation') },
        { id: 'page-marine', icon: '≋', title: 'Marine', hint: 'Open maritime intelligence', run: () => callGlobal('switchPage', 'marine') },
        { id: 'page-videos', icon: '▶', title: 'Hot Videos', hint: 'Open active-event video sources', run: () => callGlobal('switchPage', 'hot-videos') },
        { id: 'page-rss', icon: '◉', title: 'RSS Feeder', hint: 'Open the raw source feed', run: () => callGlobal('switchPage', 'rss-feeder') },
        { id: 'page-custom', icon: '◇', title: 'Custom Workspace', hint: 'Open custom modules and tools', run: () => callGlobal('switchPage', 'custom') },
    ];

    const actionCommands = [
        { id: 'action-refresh', icon: '↻', title: 'Fetch latest intelligence', hint: 'Trigger a source refresh', keywords: 'refresh fetch update sync', run: () => callGlobal('triggerFetch') },
        { id: 'action-dashboard', icon: '+', title: 'Create dashboard', hint: 'Build a new modular dashboard', keywords: 'new layout panels', run: () => callGlobal('openDashboardModal') },
        { id: 'action-settings', icon: '⚙', title: 'Open settings', hint: 'Configure alerts, feeds, and display', keywords: 'preferences sources configuration', run: () => callGlobal('toggleSettings') },
        { id: 'action-density', icon: '≡', title: 'Toggle compact density', hint: 'Fit more intelligence on screen', keywords: 'compact spacing layout', run: () => toggleDensity(true) },
        { id: 'action-theme', icon: '◐', title: 'Cycle visual theme', hint: 'Move to the next installed theme', keywords: 'appearance color dark light', run: cycleTheme },
        { id: 'action-focus', icon: '⌕', title: 'Focus current feed filter', hint: 'Jump to the first visible filter', keywords: 'search find filter', run: focusPrimaryFilter },
        { id: 'action-help', icon: '?', title: 'Open help', hint: 'Show controls and shortcuts', keywords: 'about guide shortcuts', run: () => callGlobal('openModal', 'helpModal') },
    ];

    let palette;
    let searchInput;
    let resultsContainer;
    let filteredCommands = [];
    let selectedIndex = 0;

    function callGlobal(name, ...args) {
        const fn = window[name];
        if (typeof fn === 'function') {
            fn(...args);
            return true;
        }
        toast(`${name} is not available in this view.`);
        return false;
    }

    function init() {
        applySavedDensity();
        buildPalette();
        bindShellControls();
        bindKeyboardShortcuts();
        startClock();
        syncNetworkStatus();
        observeActivePage();
        improveStaticAccessibility();
    }

    function applySavedDensity() {
        const density = localStorage.getItem(STORAGE_KEYS.density) || 'comfortable';
        document.body.classList.toggle('density-compact', density === 'compact');
        updateDensityButton();
    }

    function toggleDensity(announce = false) {
        const compact = document.body.classList.toggle('density-compact');
        localStorage.setItem(STORAGE_KEYS.density, compact ? 'compact' : 'comfortable');
        updateDensityButton();
        if (announce) {
            toast(compact ? 'Compact density enabled.' : 'Comfortable density enabled.');
        }
    }

    function updateDensityButton() {
        const button = document.getElementById('densityToggle');
        if (!button) return;
        const compact = document.body.classList.contains('density-compact');
        button.setAttribute('aria-pressed', String(compact));
        button.title = compact ? 'Use comfortable density' : 'Use compact density';
        const label = button.querySelector('.action-label');
        if (label) label.textContent = compact ? 'Comfortable' : 'Compact';
    }

    function cycleTheme() {
        const selector = document.getElementById('themeSelector');
        if (!selector || !selector.options.length) return;
        selector.selectedIndex = (selector.selectedIndex + 1) % selector.options.length;
        selector.dispatchEvent(new Event('change', { bubbles: true }));
        toast(`Theme: ${selector.options[selector.selectedIndex].text}`);
    }

    function focusPrimaryFilter() {
        const candidates = [
            ...document.querySelectorAll('input[type="search"], .filter-input, .feed-filter-input, input[placeholder*="Search" i]'),
        ];
        const visible = candidates.find((node) => isVisible(node));
        if (!visible) {
            toast('No visible feed filter is available in this workspace.');
            return;
        }
        visible.focus();
        if (typeof visible.select === 'function') visible.select();
    }

    function isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    function buildPalette() {
        palette = document.createElement('div');
        palette.className = 'command-palette';
        palette.id = 'commandPalette';
        palette.setAttribute('role', 'dialog');
        palette.setAttribute('aria-modal', 'true');
        palette.setAttribute('aria-label', 'Command palette');
        palette.innerHTML = `
            <div class="command-dialog">
                <div class="command-search-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <label class="sr-only" for="commandSearch">Search commands</label>
                    <input id="commandSearch" type="search" autocomplete="off" placeholder="Search pages, actions, and tools…">
                    <button class="btn btn-icon" type="button" id="commandClose" title="Close command palette" aria-label="Close command palette">Esc</button>
                </div>
                <div class="command-results" id="commandResults" role="listbox"></div>
                <div class="command-footer">↑ ↓ navigate · Enter run · Esc close · Ctrl/⌘ K open</div>
            </div>
        `;
        document.body.appendChild(palette);

        searchInput = palette.querySelector('#commandSearch');
        resultsContainer = palette.querySelector('#commandResults');

        searchInput.addEventListener('input', () => renderCommands(searchInput.value));
        searchInput.addEventListener('keydown', handlePaletteKeys);
        palette.querySelector('#commandClose').addEventListener('click', closePalette);
        palette.addEventListener('mousedown', (event) => {
            if (event.target === palette) closePalette();
        });
        resultsContainer.addEventListener('click', (event) => {
            const item = event.target.closest('.command-item');
            if (!item) return;
            runCommand(item.dataset.commandId);
        });

        renderCommands('');
    }

    function getCommands() {
        return [...pageCommands, ...actionCommands];
    }

    function renderCommands(query) {
        const normalized = query.trim().toLowerCase();
        filteredCommands = getCommands().filter((command) => {
            const haystack = `${command.title} ${command.hint} ${command.keywords || ''}`.toLowerCase();
            return !normalized || haystack.includes(normalized);
        });
        selectedIndex = Math.min(selectedIndex, Math.max(filteredCommands.length - 1, 0));

        if (!filteredCommands.length) {
            resultsContainer.innerHTML = '<div class="command-item-hint" style="padding:18px;text-align:center;">No matching commands</div>';
            return;
        }

        resultsContainer.innerHTML = filteredCommands.map((command, index) => `
            <button class="command-item${index === selectedIndex ? ' active' : ''}" type="button" role="option"
                    aria-selected="${index === selectedIndex}" data-command-id="${escapeAttribute(command.id)}">
                <span class="command-item-icon" aria-hidden="true">${escapeHtml(command.icon)}</span>
                <span class="command-item-copy">
                    <span class="command-item-title">${escapeHtml(command.title)}</span>
                    <span class="command-item-hint">${escapeHtml(command.hint)}</span>
                </span>
            </button>
        `).join('');
    }

    function handlePaletteKeys(event) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = (selectedIndex + 1) % Math.max(filteredCommands.length, 1);
            renderCommands(searchInput.value);
            scrollSelectedIntoView();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = (selectedIndex - 1 + Math.max(filteredCommands.length, 1)) % Math.max(filteredCommands.length, 1);
            renderCommands(searchInput.value);
            scrollSelectedIntoView();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const command = filteredCommands[selectedIndex];
            if (command) runCommand(command.id);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closePalette();
        }
    }

    function scrollSelectedIntoView() {
        resultsContainer.querySelector('.command-item.active')?.scrollIntoView({ block: 'nearest' });
    }

    function runCommand(id) {
        const command = getCommands().find((item) => item.id === id);
        if (!command) return;
        closePalette();
        requestAnimationFrame(() => command.run());
    }

    function openPalette() {
        if (!palette) return;
        palette.classList.add('open');
        document.body.style.overflow = 'hidden';
        searchInput.value = '';
        selectedIndex = 0;
        renderCommands('');
        requestAnimationFrame(() => searchInput.focus());
    }

    function closePalette() {
        if (!palette) return;
        palette.classList.remove('open');
        document.body.style.overflow = '';
    }

    function bindShellControls() {
        document.getElementById('commandPaletteTrigger')?.addEventListener('click', openPalette);
        document.getElementById('densityToggle')?.addEventListener('click', () => toggleDensity(true));

        const dashboardContainer = document.getElementById('dashboardContainer');
        if (dashboardContainer) {
            dashboardContainer.setAttribute('tabindex', '-1');
        }
    }

    function bindKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            const target = event.target;
            const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                palette?.classList.contains('open') ? closePalette() : openPalette();
                return;
            }

            if (event.key === 'Escape' && palette?.classList.contains('open')) {
                closePalette();
                return;
            }

            if (!typing && event.key === '/') {
                event.preventDefault();
                focusPrimaryFilter();
            }

            if (!typing && event.key.toLowerCase() === 'r' && event.shiftKey) {
                event.preventDefault();
                callGlobal('triggerFetch');
            }
        });
    }

    function startClock() {
        const clock = document.getElementById('utcClock');
        if (!clock) return;

        const update = () => {
            const now = new Date();
            const utc = new Intl.DateTimeFormat('en-US', {
                timeZone: 'UTC',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }).format(now);
            clock.textContent = `${utc} Z`;
            clock.dateTime = now.toISOString();
        };

        update();
        window.setInterval(update, 1000);
    }

    function syncNetworkStatus() {
        const status = document.getElementById('connectionStatus');
        if (!status) return;

        const apply = () => {
            const online = navigator.onLine;
            status.classList.toggle('offline', !online);
            status.setAttribute('title', online ? 'Browser network is online; live service status appears here' : 'Browser network is offline');
            if (!online) {
                const copy = status.querySelector('.status-copy');
                if (copy) copy.textContent = 'OFFLINE';
            }
        };

        window.addEventListener('online', () => {
            apply();
            toast('Network connection restored.');
        });
        window.addEventListener('offline', () => {
            apply();
            toast('Network connection lost.');
        });
        apply();
    }

    function observeActivePage() {
        const nav = document.getElementById('pageNav');
        const title = document.getElementById('workspaceTitle');
        if (!nav || !title) return;

        const sync = () => {
            const active = nav.querySelector('.page-btn.active .page-label');
            const label = active?.textContent?.trim() || 'Command Center';
            title.textContent = label;
            document.title = `${label} · Intel Terminal 3000`;
        };

        new MutationObserver(sync).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
        sync();
    }

    function improveStaticAccessibility() {
        document.querySelectorAll('.modal .btn-icon').forEach((button) => {
            if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Close dialog');
        });

        document.querySelectorAll('.page-btn').forEach((button) => {
            button.setAttribute('type', 'button');
        });

        const ticker = document.getElementById('criticalTicker');
        if (ticker) {
            ticker.setAttribute('role', 'region');
            ticker.setAttribute('aria-label', 'Critical intelligence alerts');
            ticker.setAttribute('aria-live', 'off');
        }
    }

    function toast(message) {
        let stack = document.querySelector('.modern-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'modern-toast-stack';
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
        }

        const item = document.createElement('div');
        item.className = 'modern-toast';
        item.textContent = message;
        stack.appendChild(item);
        window.setTimeout(() => item.remove(), 3200);
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.IntelTerminalModern = {
        openPalette,
        closePalette,
        toggleDensity,
        toast,
    };
})();
