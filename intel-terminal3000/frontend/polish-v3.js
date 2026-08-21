/* Intel Terminal 3000 — readability, theme and content polish v3 */
(() => {
    'use strict';

    const STORAGE = {
        font: 'intel-v3-font-size',
        severity: 'intel-v3-severity-style',
        sourceTab: 'intel-v3-source-tab',
    };

    const FONT_OPTIONS = ['standard', 'large', 'xl'];
    const SEVERITY_OPTIONS = ['balanced', 'contrast'];

    const INTELLIGENCE_PACKS = [
        {
            id: 'disaster-watch',
            name: 'Natural Disaster Watch',
            description: 'Earthquakes, tsunami, volcanoes, wildfire, flooding and severe storms.',
            category: 'disaster',
            icon: '△',
            source: {
                name: 'GDELT - Natural Disaster Watch',
                source_type: 'gdelt',
                category: 'disaster',
                config: { query: 'earthquake OR tsunami OR volcano OR wildfire OR flooding OR hurricane OR tornado', max_records: 50 },
            },
        },
        {
            id: 'infrastructure-watch',
            name: 'Critical Infrastructure',
            description: 'Power grids, telecom failures, pipelines, ports and major service outages.',
            category: 'infrastructure',
            icon: '⌁',
            source: {
                name: 'GDELT - Critical Infrastructure',
                source_type: 'gdelt',
                category: 'infrastructure',
                config: { query: 'power outage OR grid failure OR telecom outage OR pipeline incident OR port closure OR infrastructure attack', max_records: 50 },
            },
        },
        {
            id: 'space-watch',
            name: 'Space & Launch Watch',
            description: 'Launches, satellites, space weather, reentries and mission anomalies.',
            category: 'space',
            icon: '◉',
            source: {
                name: 'GDELT - Space and Launch Watch',
                source_type: 'gdelt',
                category: 'space',
                config: { query: 'rocket launch OR satellite OR space weather OR solar flare OR spacecraft anomaly OR reentry', max_records: 40 },
            },
        },
        {
            id: 'health-watch',
            name: 'Public Health Watch',
            description: 'Outbreaks, contamination, recalls, emergency declarations and hospital strain.',
            category: 'health',
            icon: '+',
            source: {
                name: 'GDELT - Public Health Watch',
                source_type: 'gdelt',
                category: 'health',
                config: { query: 'disease outbreak OR contamination OR public health emergency OR product recall OR hospital capacity', max_records: 40 },
            },
        },
        {
            id: 'maritime-watch',
            name: 'Maritime Chokepoints',
            description: 'Canals, straits, piracy, shipping disruptions and port security.',
            category: 'marine',
            icon: '≋',
            source: {
                name: 'GDELT - Maritime Chokepoints',
                source_type: 'gdelt',
                category: 'marine',
                config: { query: 'shipping disruption OR maritime security OR piracy OR port closure OR canal blockage OR strait tension', max_records: 50 },
            },
        },
        {
            id: 'civil-watch',
            name: 'Elections & Civil Unrest',
            description: 'Election security, protests, curfews, coups and political instability.',
            category: 'civil',
            icon: '◇',
            source: {
                name: 'GDELT - Elections and Civil Unrest',
                source_type: 'gdelt',
                category: 'civil',
                config: { query: 'election security OR mass protest OR civil unrest OR curfew OR coup OR political violence', max_records: 50 },
            },
        },
        {
            id: 'supply-watch',
            name: 'Supply Chain Watch',
            description: 'Shortages, factory stoppages, logistics failures and strategic commodities.',
            category: 'economic',
            icon: '▦',
            source: {
                name: 'GDELT - Supply Chain Watch',
                source_type: 'gdelt',
                category: 'economic',
                config: { query: 'supply chain disruption OR factory shutdown OR logistics crisis OR commodity shortage OR export restriction', max_records: 45 },
            },
        },
        {
            id: 'ai-watch',
            name: 'AI & Emerging Technology',
            description: 'Frontier models, AI incidents, regulation, robotics and strategic technology.',
            category: 'technology',
            icon: '⌘',
            source: {
                name: 'GDELT - AI and Emerging Technology',
                source_type: 'gdelt',
                category: 'technology',
                config: { query: 'artificial intelligence OR frontier model OR AI regulation OR robotics OR quantum computing OR autonomous system', max_records: 45 },
            },
        },
    ];

    const VIDEO_PLATFORMS = [
        { id: 'youtube', label: 'YouTube', match: /(?:youtube\.com|youtu\.be)/i },
        { id: 'vimeo', label: 'Vimeo', match: /vimeo\.com/i },
        { id: 'rumble', label: 'Rumble', match: /rumble\.com/i },
        { id: 'twitch', label: 'Twitch', match: /twitch\.tv/i },
        { id: 'dailymotion', label: 'Dailymotion', match: /dailymotion\.com|dai\.ly/i },
        { id: 'streamable', label: 'Streamable', match: /streamable\.com/i },
        { id: 'social-video', label: 'Social video', match: /(?:tiktok\.com|instagram\.com\/(?:reel|tv)|x\.com|twitter\.com)/i },
    ];

    const sourceState = {
        sources: [],
        filtered: [],
        tab: 'configured',
        query: '',
        category: '',
        type: '',
        loading: false,
    };

    let sourceDrawer;
    let sourceScrim;
    let dashboardObserver;

    function init() {
        if (document.body.dataset.polishV3 === 'ready') return;
        document.body.dataset.polishV3 = 'ready';
        document.body.classList.add('intel-polish-v3');

        restoreDisplayPreferences();
        augmentAppearanceDrawer();
        buildSourceLibrary();
        interceptSourceAction();
        bindPolishActions();
        enhanceVideoModule();
        observeDashboardPanels();
    }

    function restoreDisplayPreferences() {
        applyFontSize(localStorage.getItem(STORAGE.font) || 'large', false);
        applySeverityStyle(localStorage.getItem(STORAGE.severity) || 'balanced', false);
    }

    function augmentAppearanceDrawer() {
        const body = document.querySelector('#intelAppearanceDrawer .intel-drawer-body');
        if (!body || body.querySelector('[data-polish-section="readability"]')) return;

        const densitySection = body.querySelector('[data-choice="density"]')?.closest('section');
        const section = document.createElement('section');
        section.dataset.polishSection = 'readability';
        section.innerHTML = `
            <div class="intel-setting-heading"><strong>Readability</strong><span>Increase type size without giving up the command-center layout</span></div>
            <div class="intel-polish-setting-block">
                <label>Interface and intelligence text</label>
                <div class="intel-choice-row intel-font-choice" data-polish-choice="font">
                    <button type="button" data-value="standard">Standard</button>
                    <button type="button" data-value="large">Large</button>
                    <button type="button" data-value="xl">Extra large</button>
                </div>
            </div>
            <div class="intel-polish-setting-block">
                <label>Severity presentation</label>
                <div class="intel-choice-row" data-polish-choice="severity">
                    <button type="button" data-value="balanced">Balanced</button>
                    <button type="button" data-value="contrast">High contrast</button>
                </div>
                <small>Balanced uses dark tinted rows and colored rails. High contrast increases alert color intensity.</small>
            </div>
        `;

        if (densitySection?.nextSibling) densitySection.parentNode.insertBefore(section, densitySection.nextSibling);
        else body.appendChild(section);
        syncAppearanceControls();
    }

    function bindPolishActions() {
        document.addEventListener('click', event => {
            const choice = event.target.closest('[data-polish-choice] [data-value]');
            if (choice) {
                const group = choice.closest('[data-polish-choice]').dataset.polishChoice;
                if (group === 'font') applyFontSize(choice.dataset.value);
                if (group === 'severity') applySeverityStyle(choice.dataset.value);
                return;
            }

            const action = event.target.closest('[data-polish-action]');
            if (!action) return;
            const name = action.dataset.polishAction;
            if (name === 'close-source-library') closeSourceLibrary();
            if (name === 'source-refresh') loadSources(true);
            if (name === 'source-add-custom') openSourceLibrary('custom', action.dataset.sourceKind || 'rss');
            if (name === 'source-add-pack') addIntelligencePack(action.dataset.packId);
            if (name === 'video-refresh') refreshVideoPanels();
        });

        document.addEventListener('change', event => {
            if (event.target.matches('[data-source-filter="category"]')) {
                sourceState.category = event.target.value;
                renderConfiguredSources();
            }
            if (event.target.matches('[data-source-filter="type"]')) {
                sourceState.type = event.target.value;
                renderConfiguredSources();
            }
            if (event.target.matches('[data-video-platform-filter]')) {
                filterVideoCards(event.target.closest('.intel-video-hub'), event.target.value);
            }
            if (event.target.matches('#intelCustomSourceType')) updateCustomSourceFields(event.target.value);
        });

        document.addEventListener('input', event => {
            if (event.target.matches('[data-source-filter="search"]')) {
                sourceState.query = event.target.value.trim().toLowerCase();
                renderConfiguredSources();
            }
        });
    }

    function applyFontSize(value, persist = true) {
        const normalized = FONT_OPTIONS.includes(value) ? value : 'large';
        document.body.dataset.intelFontSize = normalized;
        if (persist) localStorage.setItem(STORAGE.font, normalized);
        syncAppearanceControls();
    }

    function applySeverityStyle(value, persist = true) {
        const normalized = SEVERITY_OPTIONS.includes(value) ? value : 'balanced';
        document.body.dataset.intelSeverityStyle = normalized;
        if (persist) localStorage.setItem(STORAGE.severity, normalized);
        syncAppearanceControls();
    }

    function syncAppearanceControls() {
        document.querySelectorAll('[data-polish-choice="font"] [data-value]').forEach(button => {
            button.classList.toggle('active', button.dataset.value === document.body.dataset.intelFontSize);
        });
        document.querySelectorAll('[data-polish-choice="severity"] [data-value]').forEach(button => {
            button.classList.toggle('active', button.dataset.value === document.body.dataset.intelSeverityStyle);
        });
    }

    function interceptSourceAction() {
        document.addEventListener('click', event => {
            const action = event.target.closest('[data-intel-action="sources"]');
            if (!action) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            openSourceLibrary();
        }, true);
    }

    function buildSourceLibrary() {
        if (document.getElementById('intelSourceLibrary')) {
            sourceDrawer = document.getElementById('intelSourceLibrary');
            sourceScrim = document.getElementById('intelSourceScrim');
            return;
        }

        sourceDrawer = document.createElement('aside');
        sourceDrawer.className = 'intel-source-library';
        sourceDrawer.id = 'intelSourceLibrary';
        sourceDrawer.setAttribute('aria-hidden', 'true');
        sourceDrawer.innerHTML = `
            <header class="intel-source-header">
                <div>
                    <small>COLLECTION CONTROL</small>
                    <h2>Intelligence Sources</h2>
                </div>
                <div class="intel-source-header-stats" id="intelSourceHeaderStats">Loading source inventory…</div>
                <button type="button" class="intel-icon-button" data-polish-action="close-source-library" aria-label="Close source library">✕</button>
            </header>
            <nav class="intel-source-tabs" aria-label="Source library views">
                <button type="button" data-source-tab="configured" class="active">Configured</button>
                <button type="button" data-source-tab="packs" class="admin-only">Intelligence packs</button>
                <button type="button" data-source-tab="custom" class="admin-only">Add custom</button>
            </nav>
            <section class="intel-source-pane active" data-source-pane="configured">
                <div class="intel-source-toolbar">
                    <label class="intel-source-search"><span>⌕</span><input type="search" data-source-filter="search" placeholder="Search source name, category or URL"></label>
                    <select data-source-filter="category" aria-label="Filter source category"><option value="">All categories</option></select>
                    <select data-source-filter="type" aria-label="Filter source type"><option value="">All types</option></select>
                    <button type="button" class="intel-control-button" data-polish-action="source-refresh">Refresh list</button>
                </div>
                <div class="intel-source-summary" id="intelSourceSummary"></div>
                <div class="intel-source-list" id="intelSourceList"><div class="intel-source-loading">Loading configured sources…</div></div>
            </section>
            <section class="intel-source-pane admin-only" data-source-pane="packs">
                <div class="intel-source-intro">
                    <div><small>FAST DEPLOYMENT</small><h3>Intelligence collection packs</h3></div>
                    <p>Add focused GDELT collectors without searching for individual feeds. Existing names are detected and will not be duplicated.</p>
                </div>
                <div class="intel-pack-grid" id="intelPackGrid"></div>
            </section>
            <section class="intel-source-pane admin-only" data-source-pane="custom">
                <div class="intel-source-intro">
                    <div><small>CUSTOM COLLECTOR</small><h3>Add a source</h3></div>
                    <p>Add RSS or Atom feeds, Reddit communities, GDELT searches, or a YouTube channel feed.</p>
                </div>
                <form class="intel-custom-source-form" id="intelCustomSourceForm">
                    <label><span>Source name</span><input required name="name" type="text" placeholder="Example: Regional Emergency Desk"></label>
                    <label><span>Collector type</span>
                        <select id="intelCustomSourceType" name="kind">
                            <option value="rss">RSS / Atom feed</option>
                            <option value="youtube">YouTube channel</option>
                            <option value="reddit">Reddit community</option>
                            <option value="gdelt">GDELT search</option>
                        </select>
                    </label>
                    <label><span>Category</span><input required name="category" type="text" placeholder="cyber, weather, local, space…"></label>
                    <div class="intel-custom-source-dynamic" id="intelCustomSourceDynamic"></div>
                    <div class="intel-custom-source-note" id="intelCustomSourceNote"></div>
                    <button type="submit" class="intel-source-submit">Add intelligence source</button>
                </form>
            </section>
        `;
        document.body.appendChild(sourceDrawer);

        sourceScrim = document.createElement('button');
        sourceScrim.type = 'button';
        sourceScrim.id = 'intelSourceScrim';
        sourceScrim.className = 'intel-source-scrim';
        sourceScrim.setAttribute('aria-label', 'Close source library');
        document.body.appendChild(sourceScrim);

        sourceScrim.addEventListener('click', closeSourceLibrary);
        sourceDrawer.querySelector('.intel-source-tabs').addEventListener('click', event => {
            const button = event.target.closest('[data-source-tab]');
            if (button) setSourceTab(button.dataset.sourceTab);
        });
        sourceDrawer.querySelector('#intelSourceList').addEventListener('click', handleSourceListAction);
        sourceDrawer.querySelector('#intelCustomSourceForm').addEventListener('submit', submitCustomSource);
        updateCustomSourceFields('rss');
        renderIntelligencePacks();
    }

    function openSourceLibrary(tab = localStorage.getItem(STORAGE.sourceTab) || 'configured', sourceKind = null) {
        buildSourceLibrary();
        setSourceTab(tab);
        sourceDrawer.classList.add('open');
        sourceDrawer.setAttribute('aria-hidden', 'false');
        sourceScrim.classList.add('open');
        document.body.classList.add('intel-source-open');
        loadSources();

        if (tab === 'custom' && sourceKind) {
            const type = sourceDrawer.querySelector('#intelCustomSourceType');
            if (type) {
                type.value = sourceKind;
                updateCustomSourceFields(sourceKind);
            }
            window.setTimeout(() => sourceDrawer.querySelector('input[name="name"]')?.focus(), 60);
        }
    }

    function closeSourceLibrary() {
        sourceDrawer?.classList.remove('open');
        sourceDrawer?.setAttribute('aria-hidden', 'true');
        sourceScrim?.classList.remove('open');
        document.body.classList.remove('intel-source-open');
    }

    function setSourceTab(tab) {
        const normalized = ['configured', 'packs', 'custom'].includes(tab) ? tab : 'configured';
        sourceState.tab = normalized;
        localStorage.setItem(STORAGE.sourceTab, normalized);
        sourceDrawer?.querySelectorAll('[data-source-tab]').forEach(button => button.classList.toggle('active', button.dataset.sourceTab === normalized));
        sourceDrawer?.querySelectorAll('[data-source-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.sourcePane === normalized));
    }

    async function loadSources(force = false) {
        if (sourceState.loading && !force) return;
        sourceState.loading = true;
        const list = sourceDrawer?.querySelector('#intelSourceList');
        if (list && !sourceState.sources.length) list.innerHTML = '<div class="intel-source-loading">Loading configured sources…</div>';
        try {
            const response = await fetch('/api/sources', { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            sourceState.sources = Array.isArray(data) ? data : data.sources || [];
            populateSourceFilters();
            renderConfiguredSources();
            renderIntelligencePacks();
        } catch (error) {
            if (list) list.innerHTML = `<div class="intel-source-error">Unable to load source inventory: ${escapeHTML(error.message)}</div>`;
        } finally {
            sourceState.loading = false;
        }
    }

    function populateSourceFilters() {
        if (!sourceDrawer) return;
        const categories = [...new Set(sourceState.sources.map(source => source.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const types = [...new Set(sourceState.sources.map(source => source.source_type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const category = sourceDrawer.querySelector('[data-source-filter="category"]');
        const type = sourceDrawer.querySelector('[data-source-filter="type"]');
        category.innerHTML = '<option value="">All categories</option>' + categories.map(value => `<option value="${escapeAttribute(value)}">${escapeHTML(titleCase(value))}</option>`).join('');
        type.innerHTML = '<option value="">All types</option>' + types.map(value => `<option value="${escapeAttribute(value)}">${escapeHTML(value.toUpperCase())}</option>`).join('');
        category.value = sourceState.category;
        type.value = sourceState.type;
    }

    function renderConfiguredSources() {
        if (!sourceDrawer) return;
        const query = sourceState.query;
        const filtered = sourceState.sources.filter(source => {
            const haystack = `${source.name || ''} ${source.category || ''} ${source.source_type || ''} ${source.url || ''}`.toLowerCase();
            if (query && !haystack.includes(query)) return false;
            if (sourceState.category && source.category !== sourceState.category) return false;
            if (sourceState.type && source.source_type !== sourceState.type) return false;
            return true;
        }).sort((a, b) => {
            const errorDelta = Number(b.error_count || 0) - Number(a.error_count || 0);
            if (errorDelta) return errorDelta;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
        sourceState.filtered = filtered;

        const enabled = sourceState.sources.filter(source => source.enabled !== false).length;
        const errors = sourceState.sources.filter(source => Number(source.error_count || 0) > 0).length;
        const header = sourceDrawer.querySelector('#intelSourceHeaderStats');
        const summary = sourceDrawer.querySelector('#intelSourceSummary');
        const list = sourceDrawer.querySelector('#intelSourceList');
        if (header) header.textContent = `${enabled} active · ${sourceState.sources.length} configured · ${errors} reporting errors`;
        if (summary) summary.innerHTML = `<span><strong>${filtered.length}</strong> shown</span><span><strong>${enabled}</strong> active</span><span class="${errors ? 'has-errors' : ''}"><strong>${errors}</strong> errors</span>`;

        if (!filtered.length) {
            list.innerHTML = '<div class="intel-source-empty">No sources match the current filters.</div>';
            return;
        }

        list.innerHTML = filtered.map(source => {
            const enabledState = source.enabled === false ? 'disabled' : 'active';
            const errorCount = Number(source.error_count || 0);
            const health = errorCount > 0 ? 'error' : enabledState;
            const fetched = source.last_fetched ? formatDateTime(source.last_fetched) : 'Not fetched yet';
            const detail = source.url || describeConfig(source.config) || 'Configuration-managed collector';
            return `
                <article class="intel-source-row" data-source-id="${Number(source.id)}" data-source-health="${health}">
                    <div class="intel-source-health"><i></i><span>${errorCount ? `${errorCount} errors` : enabledState}</span></div>
                    <div class="intel-source-copy">
                        <div class="intel-source-name"><strong>${escapeHTML(source.name || 'Unnamed source')}</strong><span>${escapeHTML((source.source_type || 'unknown').toUpperCase())}</span><span>${escapeHTML(titleCase(source.category || 'uncategorized'))}</span></div>
                        <p title="${escapeAttribute(detail)}">${escapeHTML(detail)}</p>
                        <small>Last fetch: ${escapeHTML(fetched)}</small>
                    </div>
                    <div class="intel-source-actions admin-only">
                        <button type="button" data-source-command="fetch">Fetch now</button>
                        <button type="button" data-source-command="delete" class="danger">Remove</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    async function handleSourceListAction(event) {
        const button = event.target.closest('[data-source-command]');
        if (!button) return;
        const row = button.closest('[data-source-id]');
        const sourceId = Number(row?.dataset.sourceId);
        const source = sourceState.sources.find(item => Number(item.id) === sourceId);
        if (!source) return;

        if (button.dataset.sourceCommand === 'fetch') {
            button.disabled = true;
            button.textContent = 'Fetching…';
            try {
                const response = await fetch(`/api/sources/${sourceId}/fetch`, { method: 'POST', headers: window.AdminKey ? window.AdminKey.withAdminHeader() : {} });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                notify(`${source.name}: ${result.saved ?? 0} new items saved`, 'success');
                await loadSources(true);
            } catch (error) {
                notify(`Source fetch failed: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Fetch now';
            }
        }

        if (button.dataset.sourceCommand === 'delete') {
            if (!window.confirm(`Remove "${source.name}" from Intel Terminal? Existing articles will remain.`)) return;
            button.disabled = true;
            try {
                const response = await fetch(`/api/sources/${sourceId}`, { method: 'DELETE', headers: window.AdminKey ? window.AdminKey.withAdminHeader() : {} });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                notify(`${source.name} removed`, 'success');
                await loadSources(true);
            } catch (error) {
                notify(`Could not remove source: ${error.message}`, 'error');
                button.disabled = false;
            }
        }
    }

    function renderIntelligencePacks() {
        const grid = sourceDrawer?.querySelector('#intelPackGrid');
        if (!grid) return;
        const existingNames = new Set(sourceState.sources.map(source => String(source.name || '').toLowerCase()));
        grid.innerHTML = INTELLIGENCE_PACKS.map(pack => {
            const installed = existingNames.has(pack.source.name.toLowerCase());
            return `
                <article class="intel-pack-card ${installed ? 'installed' : ''}">
                    <span class="intel-pack-icon">${pack.icon}</span>
                    <div><strong>${escapeHTML(pack.name)}</strong><p>${escapeHTML(pack.description)}</p><small>${escapeHTML(titleCase(pack.category))} · GDELT collector</small></div>
                    <button type="button" data-polish-action="source-add-pack" data-pack-id="${pack.id}" ${installed ? 'disabled' : ''}>${installed ? 'Installed' : 'Add pack'}</button>
                </article>
            `;
        }).join('');
    }

    async function addIntelligencePack(packId) {
        const pack = INTELLIGENCE_PACKS.find(item => item.id === packId);
        if (!pack) return;
        const exists = sourceState.sources.some(source => String(source.name || '').toLowerCase() === pack.source.name.toLowerCase());
        if (exists) {
            notify(`${pack.name} is already installed`, 'info');
            return;
        }
        try {
            await createSource(pack.source);
            notify(`${pack.name} added`, 'success');
            await loadSources(true);
        } catch (error) {
            notify(`Could not add pack: ${error.message}`, 'error');
        }
    }

    function updateCustomSourceFields(kind) {
        const dynamic = sourceDrawer?.querySelector('#intelCustomSourceDynamic');
        const note = sourceDrawer?.querySelector('#intelCustomSourceNote');
        if (!dynamic || !note) return;
        const templates = {
            rss: {
                html: '<label><span>Feed URL</span><input required name="target" type="url" placeholder="https://example.com/feed.xml"></label>',
                note: 'RSS and Atom are collected directly by the existing feed parser.',
            },
            youtube: {
                html: '<label><span>YouTube channel ID</span><input required name="target" type="text" placeholder="UC… channel ID"></label>',
                note: 'Use the channel ID, not the display name. Intel Terminal converts it to the official channel video feed.',
            },
            reddit: {
                html: '<label><span>Subreddit</span><input required name="target" type="text" placeholder="worldnews"></label>',
                note: 'Enter the community name without r/. Public hot posts are collected.',
            },
            gdelt: {
                html: '<label><span>Search expression</span><textarea required name="target" rows="4" placeholder="rail outage OR fiber cut OR communications disruption"></textarea></label>',
                note: 'Use OR to combine related terms. Keep each collector focused for better signal quality.',
            },
        };
        const template = templates[kind] || templates.rss;
        dynamic.innerHTML = template.html;
        note.textContent = template.note;
    }

    async function submitCustomSource(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const name = String(data.get('name') || '').trim();
        const category = String(data.get('category') || '').trim().toLowerCase();
        const kind = String(data.get('kind') || 'rss');
        const target = String(data.get('target') || '').trim();
        if (!name || !category || !target) return;

        let payload;
        if (kind === 'youtube') {
            const channelId = target.replace(/\s+/g, '');
            payload = {
                name,
                source_type: 'rss',
                category,
                url: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
                config: { video_source: true, channel_id: channelId },
            };
        } else if (kind === 'reddit') {
            payload = { name, source_type: 'reddit', category, config: { subreddit: target.replace(/^r\//i, '') } };
        } else if (kind === 'gdelt') {
            payload = { name, source_type: 'gdelt', category, config: { query: target, max_records: 50 } };
        } else {
            payload = { name, source_type: 'rss', category, url: target };
        }

        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        submit.textContent = 'Adding source…';
        try {
            await createSource(payload);
            notify(`${name} added`, 'success');
            form.reset();
            form.querySelector('#intelCustomSourceType').value = 'rss';
            updateCustomSourceFields('rss');
            await loadSources(true);
            setSourceTab('configured');
            refreshVideoPanels();
        } catch (error) {
            notify(`Could not add source: ${error.message}`, 'error');
        } finally {
            submit.disabled = false;
            submit.textContent = 'Add intelligence source';
        }
    }

    async function createSource(payload) {
        const duplicate = sourceState.sources.find(source => {
            const sameName = String(source.name || '').toLowerCase() === String(payload.name || '').toLowerCase();
            const sameUrl = payload.url && source.url && String(source.url).toLowerCase() === String(payload.url).toLowerCase();
            return sameName || sameUrl;
        });
        if (duplicate) throw new Error('A source with this name or URL already exists');
        const response = await fetch('/api/sources', {
            method: 'POST',
            headers: window.AdminKey
                ? window.AdminKey.withAdminHeader({ 'Content-Type': 'application/json', Accept: 'application/json' })
                : { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try { message = (await response.json()).detail || message; } catch (_) { /* noop */ }
            throw new Error(message);
        }
        return response.json();
    }

    function enhanceVideoModule() {
        window.initVideosPanel = enhancedInitVideosPanel;
        window.openIntelSourceLibrary = openSourceLibrary;
        window.refreshEnhancedVideoPanels = refreshVideoPanels;
    }

    function observeDashboardPanels() {
        const dashboard = document.getElementById('dashboardContainer');
        if (!dashboard) return;
        dashboardObserver?.disconnect();
        dashboardObserver = new MutationObserver(() => {
            window.requestAnimationFrame(() => {
                dashboard.querySelectorAll('.panel[data-module="videos"]').forEach(panel => {
                    if (!panel.querySelector('.intel-video-hub') && panel.dataset.videoEnhancing !== 'true') {
                        enhancedInitVideosPanel({ id: panel.id, module: 'videos', filters: {} });
                    }
                });
            });
        });
        dashboardObserver.observe(dashboard, { childList: true, subtree: true });
    }

    async function refreshVideoPanels() {
        const panels = [...document.querySelectorAll('.panel[data-module="videos"]')];
        await Promise.all(panels.map(panel => enhancedInitVideosPanel({ id: panel.id, module: 'videos', filters: {} }, true)));
    }

    async function enhancedInitVideosPanel(config, force = false) {
        const panel = document.getElementById(config.id);
        const content = document.getElementById(`${config.id}-content`);
        if (!content || !panel) return;
        if (panel.dataset.videoEnhancing === 'true' && !force) return;
        panel.dataset.videoEnhancing = 'true';
        content.innerHTML = '<div class="intel-video-loading"><div class="spinner"></div><span>Scanning recent intelligence for video and channel sources…</span></div>';

        try {
            const [articleResponse, sourceResponse] = await Promise.all([
                fetch('/api/articles?limit=300', { headers: { Accept: 'application/json' } }),
                fetch('/api/sources', { headers: { Accept: 'application/json' } }),
            ]);
            if (!articleResponse.ok) throw new Error(`Articles HTTP ${articleResponse.status}`);
            const articlesRaw = await articleResponse.json();
            const sourcesRaw = sourceResponse.ok ? await sourceResponse.json() : [];
            const articles = Array.isArray(articlesRaw) ? articlesRaw : articlesRaw.articles || [];
            const sources = Array.isArray(sourcesRaw) ? sourcesRaw : sourcesRaw.sources || [];
            const videos = articles.map(article => ({ ...article, platform: detectVideoPlatform(article.link) })).filter(article => article.platform);
            const channels = sources.filter(source => isVideoSource(source));
            renderVideoHub(content, videos, channels);
        } catch (error) {
            content.innerHTML = `<div class="intel-video-empty"><span>VIDEO DESK OFFLINE</span><strong>Unable to load video intelligence</strong><p>${escapeHTML(error.message)}</p><button type="button" data-polish-action="video-refresh">Retry</button></div>`;
        } finally {
            panel.dataset.videoEnhancing = 'false';
        }
    }

    function renderVideoHub(content, videos, channels) {
        const platformCounts = videos.reduce((counts, item) => {
            counts[item.platform] = (counts[item.platform] || 0) + 1;
            return counts;
        }, {});
        const platforms = Object.keys(platformCounts).sort();
        const priority = videos.filter(item => ['critical', 'high'].includes(item.severity)).length;

        content.innerHTML = `
            <div class="intel-video-hub">
                <header class="intel-video-toolbar">
                    <div><small>VISUAL INTELLIGENCE</small><strong>${videos.length} recent video links · ${channels.length} channel feeds · ${priority} priority</strong></div>
                    <select data-video-platform-filter aria-label="Filter video platform">
                        <option value="">All platforms</option>
                        ${platforms.map(platform => `<option value="${escapeAttribute(platform)}">${escapeHTML(platformLabel(platform))} (${platformCounts[platform]})</option>`).join('')}
                    </select>
                    <button type="button" data-polish-action="source-add-custom" data-source-kind="youtube">+ Channel</button>
                    <button type="button" data-polish-action="video-refresh">Refresh</button>
                </header>
                ${channels.length ? `
                    <section class="intel-video-channels">
                        <div class="intel-video-section-title"><span>CHANNEL COLLECTORS</span><small>Configured YouTube and video-oriented feeds</small></div>
                        <div class="intel-channel-strip">
                            ${channels.slice(0, 12).map(source => `<button type="button" data-polish-action="source-add-custom" data-source-kind="youtube" title="Manage video sources"><strong>${escapeHTML(source.name || 'Video channel')}</strong><small>${escapeHTML(titleCase(source.category || 'video'))}</small></button>`).join('')}
                        </div>
                    </section>
                ` : ''}
                <section class="intel-video-results">
                    <div class="intel-video-section-title"><span>RECENT VIDEO-LINKED INTELLIGENCE</span><small>Detected across the article collection</small></div>
                    <div class="intel-video-grid">
                        ${videos.length ? videos.map(renderVideoCard).join('') : `
                            <div class="intel-video-empty">
                                <span>NO VIDEO LINKS DETECTED</span>
                                <strong>Add a YouTube channel collector</strong>
                                <p>The previous video module only searched twelve high-severity articles. This desk now scans the latest 300 reports and every configured channel feed.</p>
                                <button type="button" data-polish-action="source-add-custom" data-source-kind="youtube">Add video channel</button>
                            </div>
                        `}
                    </div>
                </section>
            </div>
        `;
    }

    function renderVideoCard(article) {
        const severity = article.severity || 'low';
        return `
            <article class="intel-video-card" data-platform="${escapeAttribute(article.platform)}" data-severity="${escapeAttribute(severity)}">
                <div class="intel-video-card-top"><span>${escapeHTML(platformLabel(article.platform))}</span><em>${escapeHTML(severity.toUpperCase())}</em></div>
                <a href="${escapeAttribute(article.link || '#')}" target="_blank" rel="noopener">${escapeHTML(article.title || 'Untitled video intelligence')}</a>
                <div class="intel-video-card-meta"><strong>${escapeHTML(article.source || 'Unknown source')}</strong><span>${escapeHTML(titleCase(article.category || 'uncategorized'))}</span><span>${escapeHTML(formatAge(article.published_at || article.created_at))}</span></div>
                <footer><span>Open visual report</span><b>↗</b></footer>
            </article>
        `;
    }

    function filterVideoCards(hub, platform) {
        if (!hub) return;
        let visible = 0;
        hub.querySelectorAll('.intel-video-card').forEach(card => {
            const show = !platform || card.dataset.platform === platform;
            card.hidden = !show;
            if (show) visible += 1;
        });
        const section = hub.querySelector('.intel-video-section-title small');
        if (section) section.textContent = platform ? `${visible} ${platformLabel(platform)} reports` : 'Detected across the article collection';
    }

    function detectVideoPlatform(link) {
        const value = String(link || '');
        return VIDEO_PLATFORMS.find(platform => platform.match.test(value))?.id || null;
    }

    function isVideoSource(source) {
        const url = String(source.url || '');
        const config = source.config || {};
        return Boolean(config.video_source || /youtube\.com\/feeds\/videos\.xml/i.test(url) || /video|youtube|livestream/i.test(`${source.name || ''} ${source.category || ''}`));
    }

    function platformLabel(id) {
        return VIDEO_PLATFORMS.find(platform => platform.id === id)?.label || titleCase(id || 'video');
    }

    function describeConfig(config) {
        if (!config || typeof config !== 'object') return '';
        if (config.query) return `Query: ${config.query}`;
        if (config.subreddit) return `Reddit: r/${config.subreddit}`;
        if (config.channel_id) return `YouTube channel: ${config.channel_id}`;
        return '';
    }

    function formatDateTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        return new Intl.DateTimeFormat([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
    }

    function formatAge(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'time unknown';
        const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    function titleCase(value) {
        return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function notify(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 3500);
    }

    function escapeHTML(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    function escapeAttribute(value) {
        return escapeHTML(value).replace(/`/g, '&#96;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.addEventListener('beforeunload', () => dashboardObserver?.disconnect());
})();
