/* Intel Terminal 3000 — Intelligence Command Center v2 */
(() => {
    'use strict';

    const STORAGE = {
        theme: 'intel-v2-theme',
        density: 'intel-v2-density',
        motion: 'intel-v2-motion',
        grid: 'intel-v2-grid',
        glow: 'intel-v2-glow',
        sidebar: 'intel-v2-sidebar',
        feedView: 'intel-v2-feed-view',
    };

    const THEMES = [
        { id: 'command', label: 'Command Dark', note: 'Operational default', colors: ['#07111f', '#11233a', '#42d9ff'] },
        { id: 'analyst', label: 'Analyst Light', note: 'High-readability daylight', colors: ['#edf3f8', '#ffffff', '#1769aa'] },
        { id: 'cyber', label: 'Cyber Operations', note: 'Cyan and violet', colors: ['#050711', '#151128', '#00e5ff'] },
        { id: 'matrix', label: 'Matrix Terminal', note: 'Monochrome green', colors: ['#020805', '#07130c', '#39ff88'] },
        { id: 'synthwave', label: 'Synthwave', note: 'Purple command deck', colors: ['#09051a', '#1d1038', '#ff4fd8'] },
        { id: 'lcars', label: 'LCARS', note: 'Retro-future operations', colors: ['#09091a', '#2a2145', '#f6a94a'] },
        { id: 'solarized', label: 'Solarized', note: 'Low-fatigue contrast', colors: ['#002b36', '#073642', '#2aa198'] },
        { id: 'nord', label: 'Nord', note: 'Cool arctic palette', colors: ['#242933', '#303744', '#88c0d0'] },
        { id: 'dracula', label: 'Dracula', note: 'Deep violet contrast', colors: ['#171821', '#282a36', '#bd93f9'] },
    ];

    const LEGACY_THEME_MAP = {
        command: '',
        analyst: 'theme-light',
        cyber: 'theme-cyberpunk',
        matrix: 'theme-matrix',
        synthwave: 'theme-synthwave',
        lcars: 'theme-lcars',
        solarized: 'theme-solarized',
        nord: 'theme-nord',
        dracula: 'theme-dracula',
    };

    const LEGACY_CLASSES = [
        'theme-light', 'theme-fun', 'theme-terminal', 'theme-synthwave',
        'theme-cyberpunk', 'theme-solarized', 'theme-nord', 'theme-dracula',
        'theme-matrix', 'theme-lcars', 'theme-half-life', 'theme-halflife',
        'theme-hal', 'theme-hackers'
    ];

    let panelObserver;
    let pageObserver;
    let metricsTimer;

    function init() {
        if (document.body.dataset.commandCenterV2 === 'ready') return;
        document.body.dataset.commandCenterV2 = 'ready';
        document.body.classList.add('intel-v2');

        buildApplicationShell();
        buildAppearanceDrawer();
        bindThemeSelector();
        restoreAppearance();
        bindGlobalActions();
        observeDashboard();
        observePageState();
        decoratePanels();
        hydrateMetrics();
        metricsTimer = window.setInterval(hydrateMetrics, 120000);
    }

    function buildApplicationShell() {
        const app = document.getElementById('app');
        const header = document.querySelector('.header');
        const pageNav = document.getElementById('pageNav');
        const workspaceHeading = document.querySelector('.workspace-heading');
        const dashboard = document.getElementById('dashboardContainer');
        const settingsSidebar = document.getElementById('settingsSidebar');
        if (!app || !header || !pageNav || !dashboard || document.querySelector('.intel-shell-v2')) return;

        const shell = document.createElement('div');
        shell.className = 'intel-shell-v2';

        const sidebar = document.createElement('aside');
        sidebar.className = 'intel-sidebar';
        sidebar.id = 'intelSidebar';
        sidebar.innerHTML = `
            <div class="intel-side-brand">
                <div class="intel-side-mark" aria-hidden="true"><span></span><span></span></div>
                <div>
                    <strong>INTEL TERMINAL</strong>
                    <small>3000 // OSINT</small>
                </div>
                <button type="button" class="intel-icon-button intel-sidebar-toggle" id="intelSidebarToggle" title="Collapse navigation" aria-label="Collapse navigation">‹</button>
            </div>
            <div class="intel-side-label">Workspaces</div>
        `;

        pageNav.classList.add('intel-side-nav');
        sidebar.appendChild(pageNav);

        const sideTools = document.createElement('div');
        sideTools.className = 'intel-side-tools';
        sideTools.innerHTML = `
            <div class="intel-side-label">Operations</div>
            <button type="button" data-intel-action="watch-critical"><span>!</span><strong>Critical focus</strong></button>
            <button type="button" data-intel-action="sources"><span>⌁</span><strong>Intelligence sources</strong></button>
            <button type="button" data-intel-action="appearance"><span>◐</span><strong>Appearance</strong></button>
            <button type="button" data-intel-action="commands"><span>⌘</span><strong>Command palette</strong></button>
        `;
        sidebar.appendChild(sideTools);

        const sidebarFooter = document.createElement('div');
        sidebarFooter.className = 'intel-side-footer';
        sidebarFooter.innerHTML = `
            <span class="intel-side-signal"><i></i> SYSTEM ONLINE</span>
            <small>Open-source intelligence workspace</small>
        `;
        sidebar.appendChild(sidebarFooter);

        const main = document.createElement('div');
        main.className = 'intel-main';

        upgradeTopbar(header);
        main.appendChild(header);

        const missionStrip = document.createElement('section');
        missionStrip.className = 'intel-mission-strip';
        missionStrip.id = 'intelMissionStrip';
        missionStrip.innerHTML = `
            <article class="intel-metric intel-metric-priority">
                <span class="intel-metric-icon">!</span>
                <div><small>Critical / high</small><strong data-metric="priority">--</strong></div>
                <em>PRIORITY QUEUE</em>
            </article>
            <article class="intel-metric">
                <span class="intel-metric-icon">◫</span>
                <div><small>Last 24 hours</small><strong data-metric="last24">--</strong></div>
                <em>NEW REPORTS</em>
            </article>
            <article class="intel-metric">
                <span class="intel-metric-icon">⌁</span>
                <div><small>Active sources</small><strong data-metric="sources">--</strong></div>
                <em>COLLECTORS</em>
            </article>
            <article class="intel-metric">
                <span class="intel-metric-icon">◎</span>
                <div><small>Mapped events</small><strong data-metric="mapped">--</strong></div>
                <em>GEOLOCATED</em>
            </article>
            <article class="intel-metric intel-metric-clock">
                <span class="intel-metric-icon">◷</span>
                <div><small>Local operations time</small><strong data-metric="localTime">--:--</strong></div>
                <em data-metric="localDate">--</em>
            </article>
        `;
        main.appendChild(missionStrip);

        const workspace = document.createElement('main');
        workspace.className = 'intel-workspace';

        if (workspaceHeading) {
            enhanceWorkspaceHeading(workspaceHeading);
            workspace.appendChild(workspaceHeading);
        } else {
            const fallbackHeading = document.createElement('section');
            fallbackHeading.className = 'workspace-heading';
            fallbackHeading.innerHTML = '<div><span class="workspace-kicker">Active workspace</span><h2 id="workspaceTitle">Command Center</h2></div>';
            enhanceWorkspaceHeading(fallbackHeading);
            workspace.appendChild(fallbackHeading);
        }

        const dashboardFrame = document.createElement('section');
        dashboardFrame.className = 'intel-dashboard-frame';
        dashboardFrame.appendChild(dashboard);
        workspace.appendChild(dashboardFrame);

        if (settingsSidebar) workspace.appendChild(settingsSidebar);
        main.appendChild(workspace);

        shell.append(sidebar, main);
        app.insertBefore(shell, app.firstChild);
    }

    function upgradeTopbar(header) {
        header.classList.add('intel-topbar');
        const row = header.querySelector('.header-row');
        if (!row) return;

        const meta = row.querySelector('.header-meta');
        const actions = row.querySelector('.header-actions');
        const brand = row.querySelector('.brand-lockup') || row.querySelector('.logo');

        const context = document.createElement('div');
        context.className = 'intel-topbar-context';
        context.innerHTML = `
            <button class="intel-icon-button intel-mobile-menu" id="intelMobileMenu" type="button" title="Open navigation" aria-label="Open navigation">☰</button>
            <div>
                <span>OPERATIONS DESK</span>
                <strong id="intelTopbarTitle">Command Center</strong>
            </div>
        `;

        const search = document.createElement('button');
        search.type = 'button';
        search.className = 'intel-global-search';
        search.id = 'intelGlobalSearch';
        search.innerHTML = '<span>⌕</span><strong>Search commands and intelligence</strong><kbd>Ctrl K</kbd>';

        const quick = document.createElement('div');
        quick.className = 'intel-topbar-quick';
        quick.innerHTML = `
            <button type="button" class="intel-icon-button" data-intel-action="refresh" title="Fetch latest intelligence">↻</button>
            <button type="button" class="intel-icon-button" data-intel-action="appearance" title="Appearance and themes">◐</button>
            <button type="button" class="intel-alert-button" data-intel-action="watch-critical"><span></span><strong data-metric="priority-mini">--</strong> alerts</button>
        `;

        if (brand) brand.classList.add('intel-topbar-legacy-brand');
        if (actions) actions.classList.add('intel-legacy-actions');
        row.prepend(context);
        if (meta) meta.before(search);
        else row.appendChild(search);
        row.appendChild(quick);
    }

    function enhanceWorkspaceHeading(heading) {
        heading.classList.add('intel-workspace-heading');
        const hint = heading.querySelector('.workspace-hint');
        if (hint) hint.remove();

        const controls = document.createElement('div');
        controls.className = 'intel-workspace-controls';
        controls.innerHTML = `
            <div class="intel-segmented" role="group" aria-label="Feed presentation">
                <button type="button" data-feed-mode="tiled" class="active">Panels</button>
                <button type="button" data-feed-mode="irc">IRC stream</button>
            </div>
            <button type="button" class="intel-control-button" data-intel-action="watch-critical">Critical only</button>
            <button type="button" class="intel-control-button" data-intel-action="refresh">Refresh intel</button>
            <button type="button" class="intel-control-button intel-control-primary" data-intel-action="new-dashboard">+ Dashboard</button>
        `;
        heading.appendChild(controls);
    }

    function buildAppearanceDrawer() {
        if (document.getElementById('intelAppearanceDrawer')) return;
        const drawer = document.createElement('aside');
        drawer.className = 'intel-drawer';
        drawer.id = 'intelAppearanceDrawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.innerHTML = `
            <div class="intel-drawer-header">
                <div><small>DISPLAY SYSTEM</small><h2>Appearance</h2></div>
                <button type="button" class="intel-icon-button" data-intel-action="close-drawer" aria-label="Close appearance">✕</button>
            </div>
            <div class="intel-drawer-body">
                <section>
                    <div class="intel-setting-heading"><strong>Theme</strong><span>Complete interface palettes</span></div>
                    <div class="intel-theme-grid">
                        ${THEMES.map(theme => `
                            <button type="button" class="intel-theme-card" data-theme-id="${theme.id}">
                                <span class="intel-theme-preview" style="--swatch-a:${theme.colors[0]};--swatch-b:${theme.colors[1]};--swatch-c:${theme.colors[2]}"><i></i><i></i><i></i></span>
                                <strong>${theme.label}</strong>
                                <small>${theme.note}</small>
                            </button>
                        `).join('')}
                    </div>
                </section>
                <section>
                    <div class="intel-setting-heading"><strong>Information density</strong><span>Control how much fits on screen</span></div>
                    <div class="intel-choice-row" data-choice="density">
                        <button type="button" data-value="comfortable">Comfortable</button>
                        <button type="button" data-value="compact">Compact</button>
                        <button type="button" data-value="dense">Maximum intel</button>
                    </div>
                </section>
                <section class="intel-toggle-list">
                    <label><span><strong>Background grid</strong><small>Subtle operational reference grid</small></span><input type="checkbox" data-setting="grid" checked></label>
                    <label><span><strong>Interface glow</strong><small>Accent lighting and status bloom</small></span><input type="checkbox" data-setting="glow" checked></label>
                    <label><span><strong>Interface motion</strong><small>Panel transitions and signal animation</small></span><input type="checkbox" data-setting="motion" checked></label>
                </section>
                <button type="button" class="intel-reset-button" data-intel-action="reset-appearance">Reset display preferences</button>
            </div>
        `;
        document.body.appendChild(drawer);

        const scrim = document.createElement('button');
        scrim.type = 'button';
        scrim.className = 'intel-drawer-scrim';
        scrim.id = 'intelDrawerScrim';
        scrim.setAttribute('aria-label', 'Close appearance panel');
        document.body.appendChild(scrim);
    }

    function bindThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (!selector) return;
        selector.addEventListener('change', () => {
            const legacy = selector.value;
            const match = Object.entries(LEGACY_THEME_MAP).find(([, value]) => value === legacy);
            applyTheme(match ? match[0] : 'command', true);
        });
    }

    function restoreAppearance() {
        applyTheme(localStorage.getItem(STORAGE.theme) || 'command', false);
        applyDensity(localStorage.getItem(STORAGE.density) || 'comfortable', false);
        applyBinarySetting('grid', localStorage.getItem(STORAGE.grid) !== 'off', false);
        applyBinarySetting('glow', localStorage.getItem(STORAGE.glow) !== 'off', false);
        applyBinarySetting('motion', localStorage.getItem(STORAGE.motion) !== 'off', false);
        applySidebar(localStorage.getItem(STORAGE.sidebar) === 'collapsed', false);
        syncFeedModeControls(localStorage.getItem(STORAGE.feedView) || 'tiled');
    }

    function applyTheme(themeId, persist = true) {
        const valid = THEMES.some(theme => theme.id === themeId) ? themeId : 'command';
        document.body.dataset.intelTheme = valid;
        document.body.classList.remove(...LEGACY_CLASSES);
        const legacyClass = LEGACY_THEME_MAP[valid];
        if (legacyClass) document.body.classList.add(legacyClass);
        if (persist) localStorage.setItem(STORAGE.theme, valid);

        document.querySelectorAll('.intel-theme-card').forEach(card => {
            const selected = card.dataset.themeId === valid;
            card.classList.toggle('active', selected);
            card.setAttribute('aria-pressed', String(selected));
        });

        const selector = document.getElementById('themeSelector');
        if (selector && selector.value !== (legacyClass || '')) selector.value = legacyClass || '';
        document.dispatchEvent(new CustomEvent('intelthemechange', { detail: { theme: valid } }));
    }

    function applyDensity(value, persist = true) {
        const density = ['comfortable', 'compact', 'dense'].includes(value) ? value : 'comfortable';
        document.body.dataset.intelDensity = density;
        document.body.classList.toggle('density-compact', density !== 'comfortable');
        if (persist) localStorage.setItem(STORAGE.density, density);
        document.querySelectorAll('[data-choice="density"] [data-value]').forEach(button => {
            button.classList.toggle('active', button.dataset.value === density);
        });
    }

    function applyBinarySetting(name, enabled, persist = true) {
        document.body.classList.toggle(`intel-${name}-off`, !enabled);
        const input = document.querySelector(`[data-setting="${name}"]`);
        if (input) input.checked = enabled;
        if (persist) localStorage.setItem(STORAGE[name], enabled ? 'on' : 'off');
    }

    function applySidebar(collapsed, persist = true) {
        document.body.classList.toggle('intel-sidebar-collapsed', collapsed);
        const button = document.getElementById('intelSidebarToggle');
        if (button) {
            button.textContent = collapsed ? '›' : '‹';
            button.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
        }
        if (persist) localStorage.setItem(STORAGE.sidebar, collapsed ? 'collapsed' : 'expanded');
    }

    function bindGlobalActions() {
        document.addEventListener('click', event => {
            const actionElement = event.target.closest('[data-intel-action]');
            if (actionElement) {
                event.preventDefault();
                handleAction(actionElement.dataset.intelAction);
                return;
            }

            const themeCard = event.target.closest('.intel-theme-card');
            if (themeCard) {
                applyTheme(themeCard.dataset.themeId);
                return;
            }

            const densityButton = event.target.closest('[data-choice="density"] [data-value]');
            if (densityButton) {
                applyDensity(densityButton.dataset.value);
                return;
            }

            const feedMode = event.target.closest('[data-feed-mode]');
            if (feedMode) {
                setGlobalFeedMode(feedMode.dataset.feedMode);
                return;
            }
        });

        document.addEventListener('change', event => {
            const setting = event.target.closest('[data-setting]');
            if (setting) applyBinarySetting(setting.dataset.setting, setting.checked);
        });

        document.getElementById('intelSidebarToggle')?.addEventListener('click', () => {
            applySidebar(!document.body.classList.contains('intel-sidebar-collapsed'));
        });

        document.getElementById('intelMobileMenu')?.addEventListener('click', () => {
            document.body.classList.toggle('intel-mobile-nav-open');
        });

        document.getElementById('intelGlobalSearch')?.addEventListener('click', openCommandPalette);
        document.getElementById('intelDrawerScrim')?.addEventListener('click', closeAppearanceDrawer);

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeAppearanceDrawer();
            if (!isTyping(event.target) && event.key.toLowerCase() === 'g') {
                document.body.classList.toggle('intel-grid-off');
                localStorage.setItem(STORAGE.grid, document.body.classList.contains('intel-grid-off') ? 'off' : 'on');
            }
        });
    }

    function handleAction(action) {
        switch (action) {
            case 'appearance':
                openAppearanceDrawer();
                break;
            case 'close-drawer':
                closeAppearanceDrawer();
                break;
            case 'commands':
                openCommandPalette();
                break;
            case 'refresh':
                callGlobal('triggerFetch');
                window.setTimeout(hydrateMetrics, 1200);
                break;
            case 'new-dashboard':
                callGlobal('openDashboardModal');
                break;
            case 'sources':
                if (!callGlobal('toggleSettings')) callGlobal('openSourceModal', 'add');
                break;
            case 'watch-critical':
                toggleCriticalFocus();
                break;
            case 'reset-appearance':
                Object.values(STORAGE).forEach(key => localStorage.removeItem(key));
                applyTheme('command');
                applyDensity('comfortable');
                applyBinarySetting('grid', true);
                applyBinarySetting('glow', true);
                applyBinarySetting('motion', true);
                applySidebar(false);
                break;
        }
    }

    function openCommandPalette() {
        const trigger = document.getElementById('commandPaletteTrigger');
        if (trigger) trigger.click();
    }

    function openAppearanceDrawer() {
        const drawer = document.getElementById('intelAppearanceDrawer');
        const scrim = document.getElementById('intelDrawerScrim');
        drawer?.classList.add('open');
        drawer?.setAttribute('aria-hidden', 'false');
        scrim?.classList.add('open');
    }

    function closeAppearanceDrawer() {
        const drawer = document.getElementById('intelAppearanceDrawer');
        const scrim = document.getElementById('intelDrawerScrim');
        drawer?.classList.remove('open');
        drawer?.setAttribute('aria-hidden', 'true');
        scrim?.classList.remove('open');
    }

    function setGlobalFeedMode(mode) {
        const normalized = mode === 'irc' ? 'irc' : 'tiled';
        localStorage.setItem(STORAGE.feedView, normalized);
        syncFeedModeControls(normalized);

        document.querySelectorAll('.panel[data-module="feed"]').forEach(panel => {
            const select = panel.querySelector('.feed-view-toggle');
            if (select && select.value !== normalized) {
                select.value = normalized;
                if (typeof window.setFeedView === 'function') window.setFeedView(panel.id, normalized);
                else select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    function syncFeedModeControls(mode) {
        document.body.dataset.feedMode = mode;
        document.querySelectorAll('[data-feed-mode]').forEach(button => {
            button.classList.toggle('active', button.dataset.feedMode === mode);
        });
    }

    function toggleCriticalFocus() {
        const enabled = !document.body.classList.contains('intel-critical-focus');
        document.body.classList.toggle('intel-critical-focus', enabled);

        document.querySelectorAll('.panel[data-module="feed"]').forEach(panel => {
            const select = panel.querySelector('.feed-filter-severity');
            if (!select) return;
            select.value = enabled ? 'critical' : '';
            if (typeof window.setFeedSeverity === 'function') window.setFeedSeverity(panel.id, select.value);
            else select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        document.querySelectorAll('[data-intel-action="watch-critical"]').forEach(button => {
            button.classList.toggle('active', enabled);
        });
    }

    function observeDashboard() {
        const dashboard = document.getElementById('dashboardContainer');
        if (!dashboard) return;
        panelObserver?.disconnect();
        panelObserver = new MutationObserver(() => {
            window.requestAnimationFrame(decoratePanels);
        });
        panelObserver.observe(dashboard, { childList: true, subtree: true });
    }

    function decoratePanels() {
        const panels = [...document.querySelectorAll('#dashboardContainer .panel')];
        panels.forEach((panel, index) => {
            panel.dataset.panelIndex = String(index + 1).padStart(2, '0');
            if (panel.dataset.intelDecorated === 'true') return;
            panel.dataset.intelDecorated = 'true';

            const header = panel.querySelector('.panel-header');
            const title = panel.querySelector('.panel-title');
            if (header && title) {
                const code = document.createElement('span');
                code.className = 'intel-panel-code';
                code.textContent = `${String(index + 1).padStart(2, '0')} / ${(panel.dataset.module || 'data').toUpperCase()}`;
                header.insertBefore(code, header.firstChild);
            }

            const content = panel.querySelector('.panel-content');
            if (content) {
                content.addEventListener('dblclick', event => {
                    if (event.target.closest('a, button, input, select, textarea, .leaflet-container')) return;
                    if (typeof window.togglePanelExpand === 'function') window.togglePanelExpand(panel.id);
                });
            }
        });

        const preferred = localStorage.getItem(STORAGE.feedView);
        if (preferred && panels.length) {
            document.querySelectorAll('.panel[data-module="feed"] .feed-view-toggle').forEach(select => {
                const panel = select.closest('.panel');
                if (panel && select.value !== preferred && typeof window.setFeedView === 'function') {
                    select.value = preferred;
                    window.setFeedView(panel.id, preferred);
                }
            });
        }
    }

    function observePageState() {
        const nav = document.getElementById('pageNav');
        if (!nav) return;
        const sync = () => {
            const active = nav.querySelector('.page-btn.active');
            const page = active?.dataset.page || 'command-center';
            const label = active?.querySelector('.page-label')?.textContent?.trim() || 'Command Center';
            document.body.dataset.intelPage = page;
            const title = document.getElementById('intelTopbarTitle');
            if (title) title.textContent = label;
            document.body.classList.remove('intel-mobile-nav-open');
        };
        pageObserver?.disconnect();
        pageObserver = new MutationObserver(sync);
        pageObserver.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
        nav.addEventListener('click', () => window.setTimeout(sync, 0));
        sync();
    }

    async function hydrateMetrics() {
        updateClockMetrics();
        try {
            const [statsResponse, articlesResponse, sourcesResponse, mapResponse] = await Promise.allSettled([
                fetch('/api/stats').then(readJson),
                fetch('/api/articles?limit=100').then(readJson),
                fetch('/api/sources').then(readJson),
                fetch('/api/map/heatmap').then(readJson),
            ]);

            const stats = resultValue(statsResponse, {});
            const articlesRaw = resultValue(articlesResponse, []);
            const sourcesRaw = resultValue(sourcesResponse, []);
            const mapData = resultValue(mapResponse, {});
            const articles = Array.isArray(articlesRaw) ? articlesRaw : articlesRaw.articles || [];
            const sources = Array.isArray(sourcesRaw) ? sourcesRaw : sourcesRaw.sources || [];
            const priority = articles.filter(article => ['critical', 'high'].includes(article.severity)).length;
            const activeSources = sources.filter(source => source.enabled !== false && source.active !== false).length;
            const mapped = Array.isArray(mapData.points) ? mapData.points.length : 0;

            setMetric('priority', formatNumber(priority));
            setMetric('priority-mini', formatNumber(priority));
            setMetric('last24', formatNumber(stats.last_24h ?? stats.last24h ?? articles.length));
            setMetric('sources', formatNumber(activeSources || sources.length));
            setMetric('mapped', formatNumber(mapped));
        } catch (error) {
            console.debug('Intel Terminal metric refresh unavailable:', error);
        }
    }

    function updateClockMetrics() {
        const now = new Date();
        setMetric('localTime', new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(now));
        setMetric('localDate', new Intl.DateTimeFormat([], { month: 'short', day: '2-digit', year: 'numeric' }).format(now).toUpperCase());
    }

    function setMetric(name, value) {
        document.querySelectorAll(`[data-metric="${name}"]`).forEach(node => {
            node.textContent = value;
        });
    }

    function formatNumber(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? new Intl.NumberFormat().format(numeric) : '--';
    }

    async function readJson(response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    function resultValue(result, fallback) {
        return result.status === 'fulfilled' ? result.value : fallback;
    }

    function callGlobal(name, ...args) {
        const fn = window[name];
        if (typeof fn !== 'function') return false;
        fn(...args);
        return true;
    }

    function isTyping(target) {
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.addEventListener('beforeunload', () => {
        if (metricsTimer) window.clearInterval(metricsTimer);
        panelObserver?.disconnect();
        pageObserver?.disconnect();
    });
})();
