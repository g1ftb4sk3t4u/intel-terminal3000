// ============ MODAL HELPERS ============
window.openModal = function(id) {
    document.getElementById(id).style.display = 'block';
}
window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
}

// ============ LOGIN TOGGLE & SETTINGS VISIBILITY ============
let isAdmin = false;
window.toggleLogin = function() {
    isAdmin = !isAdmin;
    document.getElementById('loginToggle').textContent = isAdmin ? 'Log Out' : 'Admin Login';
    document.getElementById('settingsSidebar').style.display = isAdmin ? '' : 'none';
    // Optionally, show/hide dashboard edit buttons, etc.
}

// On load, hide settings sidebar unless admin
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('settingsSidebar').style.display = isAdmin ? '' : 'none';
});
// ============ CRITICAL ALERTS TICKER (ALWAYS ON) ============
let tickerInterval = null;
let tickerSpeed = 120;
let tickerCategory = 'critical';

async function startCriticalTicker() {
    await updateCriticalTicker();
    if (tickerInterval) clearInterval(tickerInterval);
    // Refresh ticker every 5 minutes (300000ms)
    tickerInterval = setInterval(updateCriticalTicker, 300000);
}

async function updateCriticalTicker() {
    const ticker = document.getElementById('criticalTicker');
    try {
        // Get top 10 newest hot headlines (critical + high severity, sorted by date)
        let filters = { 
            limit: 10,
            severity: 'critical,high' // Get both critical and high severity
        };
        
        const articles = await loadArticles(filters);
        
        if (!articles || articles.length === 0) {
            ticker.innerHTML = '<span class="ticker-content">🔴 INTEL TERMINAL 3000 - No alerts at this time</span>';
            return;
        }
        
        // Sort by published date (newest first)
        const sortedArticles = articles.sort((a, b) => {
            const dateA = new Date(a.published_at || a.created_at);
            const dateB = new Date(b.published_at || b.created_at);
            return dateB - dateA;
        });
        
        // Take top 10
        const topArticles = sortedArticles.slice(0, 10);
        
        const items = topArticles.map(a => {
            const url = a.link ? escapeHtml(a.link) : '#';
            const icon = a.severity === 'critical' ? '🚨' : '⚠️';
            const timeAgo = formatTimeAgo(a.published_at || a.created_at);
            return `<span style="margin-right:48px;">${icon} <a href="${url}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;font-weight:600;">${escapeHtml(a.title)}</a> <span style="opacity:0.7;">(${escapeHtml(a.region || 'Global')} • ${timeAgo})</span></span>`;
        }).join('');
        
        ticker.innerHTML = `<span class="ticker-content">${items}</span>`;
    } catch (e) {
        console.error('Ticker error:', e);
        ticker.innerHTML = '<span class="ticker-content">🔴 INTEL TERMINAL 3000 - Error loading headlines</span>';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // Always show ticker at bottom
    document.getElementById('criticalTicker').style.display = '';
    tickerSpeed = parseInt(localStorage.getItem('tickerSpeed') || '120');
    document.body.style.setProperty('--ticker-speed', tickerSpeed + 's');
    startCriticalTicker();
});
// ============ THEME SWITCHER ============
function setTheme(themeClass) {
    document.body.classList.remove('theme-light', 'theme-fun', 'theme-terminal', 'theme-synthwave', 'theme-lcars', 'theme-half-life', 'theme-halflife', 'theme-hal', 'theme-hackers');
    if (themeClass) document.body.classList.add(themeClass);
    localStorage.setItem('theme', themeClass || '');
    // Force full dashboard re-render to apply theme everywhere
    if (typeof renderDashboard === 'function' && state.currentDashboard) {
        renderDashboard();
    }
}

window.setTheme = setTheme;

window.addEventListener('DOMContentLoaded', () => {
    // Restore theme from localStorage
    const savedTheme = localStorage.getItem('theme') || '';
    setTheme(savedTheme);
    // Theme selector event
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = savedTheme;
        themeSelector.addEventListener('change', (e) => setTheme(e.target.value));
    }
});
window.renderPanel = renderPanel;
window.renderSourcesList = renderSourcesList;
window.updateDashboardSelector = updateDashboardSelector;
/**
 * Intel Terminal 3000 - Frontend Application
 * Multi-dashboard intelligence platform
 */

// Configuration
const API_BASE = (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:8080';
    }
    return '';
})();

window.API_BASE = API_BASE; // Make available to settings.js

const WS_URL = (() => {
    if (API_BASE) {
        return API_BASE.replace('http', 'ws') + '/ws';
    }
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${window.location.host}/ws`;
})();

// State
let state = {
    connected: false,
    websocket: null,
    articles: [],
    sources: [],
    dashboards: [],
    currentDashboard: null,
    selectedLayout: '2x2',
    panelConfigs: [],
    stats: {},
    map: null,
    heatLayer: null,
    aircraftLayer: null,
    aircraftRefreshInterval: null,
};

// Module definitions for panels
const MODULES = {
    feed: {
        name: 'Feed',
        icon: '📰',
        description: 'Live article feed',
        hasFilters: true,
        filters: ['category', 'source_type', 'region'],
    },
    map: {
        name: 'Heat Map',
        icon: '🗺️',
        description: 'Geographic event visualization',
        hasFilters: false,
    },
    stats: {
        name: 'Statistics',
        icon: '📊',
        description: 'Real-time statistics',
        hasFilters: false,
    },
    chart: {
        name: 'Timeline',
        icon: '📈',
        description: 'Activity timeline chart',
        hasFilters: false,
    },
    alerts: {
        name: 'Alerts',
        icon: '🔔',
        description: 'Critical alerts only',
        hasFilters: false,
    },
    starred: {
        name: 'Starred',
        icon: '⭐',
        description: 'Starred articles',
        hasFilters: false,
    },
    trending: {
        name: 'Trending',
        icon: '🔥',
        description: 'Regional spikes and trending topics',
        hasFilters: false,
    },
    aircraft: {
        name: 'Aircraft',
        icon: '✈️',
        description: 'ADS-B aircraft tracking',
        hasFilters: false,
    },
    marine: {
        name: 'Marine',
        icon: '🚢',
        description: 'AIS ship tracking',
        hasFilters: false,
    },
    templates: {
        name: 'Templates',
        icon: '📋',
        description: 'Dashboard templates',
        hasFilters: false,
    },
    videos: {
        name: 'Hot Videos',
        icon: '🎥',
        description: 'Video sources for active events',
        hasFilters: false,
    },
    web: {
        name: 'Web View',
        icon: '🌐',
        description: 'Embedded web source module',
        hasFilters: false,
    },
    clock: {
        name: 'World Clock',
        icon: '🕐',
        description: 'World timezone clocks',
        hasFilters: false,
    },
    custom: {
        name: 'Custom Data',
        icon: '⚙️',
        description: 'Custom data visualization',
        hasFilters: false,
    },
};

// Categories
let CATEGORIES = [
    { value: '', label: 'All Categories' },
];

// Fetch categories from backend and merge with defaults
async function fetchCategories() {
    try {
        const categoryResponse = await api('/categories');
        const backendCategories = categoryResponse.categories || [];
        const existing = new Set(CATEGORIES.map(c => c.value));
        backendCategories.forEach(cat => {
            if (!existing.has(cat)) {
                CATEGORIES.push({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) });
            }
        });
    } catch (e) {
        try {
            const stats = await api('/stats');
            const backendCategories = Object.keys(stats.by_category || {});
            const existing = new Set(CATEGORIES.map(c => c.value));
            backendCategories.forEach(cat => {
                if (!existing.has(cat)) {
                    CATEGORIES.push({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) });
                }
            });
        } catch (_) {
            // fallback: do nothing
        }
    }
}

const SEVERITIES = [
    { value: '', label: 'All Severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

const SOURCE_TYPES = [
    { value: '', label: 'All Sources' },
    { value: 'rss', label: 'RSS' },
    { value: 'gdelt', label: 'GDELT' },
    { value: 'reddit', label: 'Reddit' },
    { value: 'bluesky', label: 'Bluesky' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'adsb', label: 'ADS-B' },
    { value: 'custom_rss', label: 'Custom RSS' },
];

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Intel Terminal 3000 initializing...');
    
    // Connect WebSocket
    connectWebSocket();
    
    // Load initial data
    await fetchCategories();
    await Promise.all([
        loadDashboards(),
        loadSources(),
        loadStats(),
    ]);
    
    // Create default dashboard if none exist
    if (state.dashboards.length === 0) {
        state.currentDashboard = createDefaultDashboard();
    } else {
        state.currentDashboard = state.dashboards.find(d => d.is_default) || state.dashboards[0];
    }
    
    // Initialize Settings Module
    if (SettingsModule) {
        await SettingsModule.init();
    }
    
    // Don't render yet - let switchPage handle it
    console.log('✅ Intel Terminal 3000 ready');
    
    // Restore saved page or default to command center
    const savedPage = localStorage.getItem('currentPage') || 'command-center';
    switchPage(savedPage);
}

// ============ WEBSOCKET ============

function connectWebSocket() {
    try {
        state.websocket = new WebSocket(WS_URL);
        
        state.websocket.onopen = () => {
            state.connected = true;
            updateConnectionStatus(true);
            console.log('📡 WebSocket connected');
        };
        
        state.websocket.onclose = () => {
            state.connected = false;
            updateConnectionStatus(false);
            console.log('📡 WebSocket disconnected, reconnecting in 5s...');
            setTimeout(connectWebSocket, 5000);
        };
        
        state.websocket.onerror = (error) => {
            console.error('📡 WebSocket error:', error);
        };
        
        state.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        };
        
        // Heartbeat
        setInterval(() => {
            if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
                state.websocket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
        
    } catch (error) {
        console.error('WebSocket connection failed:', error);
        setTimeout(connectWebSocket, 5000);
    }
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'new_article':
            handleNewArticle(message.article);
            break;
        case 'pong':
            // Heartbeat response
            break;
        default:
            console.log('Unknown message type:', message.type);
    }
}

function handleNewArticle(article) {
    // Add to state
    state.articles.unshift(article);
    
    // Trigger re-render of relevant panels
    document.querySelectorAll('.panel[data-module="feed"]').forEach(panel => {
        const panelId = panel.id;
        refreshFeedPanel(panelId);
    });
    
    // Play sound for critical/high
    if (article.severity === 'critical' || article.severity === 'high') {
        playAlertSound();
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (connected) {
        indicator.classList.remove('disconnected');
        indicator.innerHTML = '<span class="pulse"></span>LIVE';
    } else {
        indicator.classList.add('disconnected');
        indicator.innerHTML = '<span class="pulse"></span>OFFLINE';
    }
}

// ============ API CALLS ============

async function api(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
}

async function loadDashboards() {
    try {
        state.dashboards = await api('/dashboards');
        updateDashboardSelector();
    } catch (error) {
        console.error('Failed to load dashboards:', error);
        state.dashboards = [];
    }
}

async function loadSources() {
    try {
        state.sources = await api('/sources');
        renderSourcesList();
    } catch (error) {
        console.error('Failed to load sources:', error);
        state.sources = [];
    }
}

async function loadStats() {
    try {
        state.stats = await api('/stats');
        const statTotal = document.getElementById('statTotal');
        const stat24h = document.getElementById('stat24h');
        if (statTotal) {
            statTotal.textContent = state.stats.total_articles || 0;
        }
        if (stat24h) {
            stat24h.textContent = state.stats.last_24h || 0;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadArticles(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
    });
    
    try {
        return await api(`/articles?${params.toString()}`);
    } catch (error) {
        console.error('Failed to load articles:', error);
        return [];
    }
}

async function loadHeatmapData(filters = {}) {
    const params = new URLSearchParams();
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.category) params.append('category', filters.category);
    try {
        return await api(`/map/heatmap?${params.toString()}`);
    } catch (error) {
        console.error('Failed to load heatmap data:', error);
        return { points: [], regions: {} };
    }
}

async function loadTimelineData() {
    try {
        return await api('/stats/timeline?days=7');
    } catch (error) {
        console.error('Failed to load timeline data:', error);
        return [];
    }
}

// ============ DASHBOARD RENDERING ============

function createDefaultDashboard() {
    return {
        id: 'default',
        name: 'Intelligence Command Center',
        layout: '2x2',
        panels: [
            { id: 'panel-1', module: 'feed', title: 'Intelligence Feed', filters: {}, feedView: 'tiled' },
            { id: 'panel-2', module: 'map', title: 'Global Heat Map', mapType: 'heatmap', filters: {} },
            { id: 'panel-3', module: 'map', title: 'Aircraft Tracking (ADS-B)', mapType: 'aircraft', filters: {} },
            { id: 'panel-4', module: 'stats', title: 'Statistics', filters: {} },
        ],
    };
}

function renderDashboard() {
    const container = document.getElementById('dashboardContainer');
    const dashboard = state.currentDashboard;
    
    // Set layout class
    container.className = `dashboard-container layout-${dashboard.layout}`;
    
    // Render panels based on layout type
    let panelsHTML = '';
    
    if (dashboard.layout === 'flexible') {
        // For flexible layouts, group panels by width or render individually
        let currentRow = [];
        let currentRowWidth = 0;
        
        dashboard.panels.forEach((panel, index) => {
            const panelWidth = parseFloat(panel.width || '50%') / 100;
            
            // If this panel is 100% width or row is getting too full, start a new row
            if (panelWidth >= 1 || currentRowWidth + panelWidth > 1) {
                if (currentRow.length > 0) {
                    panelsHTML += `<div class="panel-row">${currentRow.map(p => renderPanel(p)).join('')}</div>`;
                    currentRow = [];
                    currentRowWidth = 0;
                }
                
                if (panelWidth >= 1) {
                    panelsHTML += renderPanel(panel);
                } else {
                    currentRow.push(panel);
                    currentRowWidth = panelWidth;
                }
            } else {
                currentRow.push(panel);
                currentRowWidth += panelWidth;
            }
        });
        
        // Render remaining panels in current row
        if (currentRow.length > 0) {
            panelsHTML += `<div class="panel-row">${currentRow.map(p => renderPanel(p)).join('')}</div>`;
        }
    } else {
        // Standard grid layouts
        panelsHTML = dashboard.panels.map(panel => renderPanel(panel)).join('');
    }
    
    container.innerHTML = panelsHTML;

    // Add source management UI
    if (!document.getElementById('sourceManagementBar')) {
        const bar = document.createElement('div');
        bar.id = 'sourceManagementBar';
        bar.style.position = 'fixed';
        bar.style.bottom = '24px';
        bar.style.right = '24px';
        bar.style.background = 'var(--bg-panel)';
        bar.style.color = 'var(--text-primary)';
        bar.style.padding = '12px 24px';
        bar.style.borderRadius = '8px';
        bar.style.boxShadow = '0 2px 16px rgba(0,0,0,0.4)';
        bar.style.zIndex = 1000;
        bar.innerHTML = `<button onclick="openSourceModal('add')" style="margin-right:12px;padding:8px 16px;background:var(--accent-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;">Add Source</button><button onclick="openSourceModal('delete')" style="margin-right:12px;padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Delete Source</button><button onclick="addCategoryPrompt()" style="margin-right:12px;padding:8px 16px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;cursor:pointer;">Add Category</button><button onclick="deleteCategoryPrompt()" style="padding:8px 16px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer;">Delete Category</button>`;
        document.body.appendChild(bar);
    }

    // Initialize each panel
    dashboard.panels.forEach(panel => {
        initializePanel(panel);
    });
}

window.openSourceModal = (mode) => {
    let modal = document.getElementById('sourceModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sourceModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = 'var(--bg-panel)';
        modal.style.color = 'var(--text-primary)';
        modal.style.padding = '32px 40px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 4px 32px rgba(0,0,0,0.7)';
        modal.style.zIndex = 10000;
        modal.style.minWidth = '320px';
        document.body.appendChild(modal);
    }
    if (mode === 'add') {
        modal.innerHTML = `<div style="font-size:1.2rem;font-weight:600;margin-bottom:12px;">Add Source</div>
            <input id='sourceName' placeholder='Name' style='width:100%;margin-bottom:8px;padding:8px;border-radius:6px;border:1px solid var(--border-color);'/>
            <input id='sourceUrl' placeholder='URL or API Endpoint' style='width:100%;margin-bottom:8px;padding:8px;border-radius:6px;border:1px solid var(--border-color);'/>
            <select id='sourceType' style='width:100%;margin-bottom:8px;padding:8px;border-radius:6px;border:1px solid var(--border-color);'>
                <option value='rss'>RSS</option>
                <option value='reddit'>Reddit</option>
                <option value='bluesky'>Bluesky</option>
                <option value='telegram'>Telegram</option>
                <option value='gdelt'>GDELT</option>
                <option value='api'>API</option>
            </select>
            <input id='sourceCategory' placeholder='Category (e.g. marine, aircraft, science, ai)' style='width:100%;margin-bottom:8px;padding:8px;border-radius:6px;border:1px solid var(--border-color);'/>
            <button onclick="addSource()" style="padding:8px 18px;font-size:1rem;background:var(--accent-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;margin-right:8px;">Add</button>
            <button onclick="document.getElementById('sourceModal').remove()" style="padding:8px 18px;font-size:1rem;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Cancel</button>`;
    } else {
        modal.innerHTML = `<div style="font-size:1.2rem;font-weight:600;margin-bottom:12px;">Delete Source</div><input id='deleteSourceId' placeholder='Source ID' style='width:100%;margin-bottom:8px;padding:8px;border-radius:6px;border:1px solid var(--border-color);'/><button onclick="deleteSourceById()" style="padding:8px 18px;font-size:1rem;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-right:8px;">Delete</button><button onclick="document.getElementById('sourceModal').remove()" style="padding:8px 18px;font-size:1rem;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Cancel</button>`;
    }
    modal.style.display = 'block';
};

window.addSource = async () => {
    const name = document.getElementById('sourceName').value;
    const url = document.getElementById('sourceUrl').value;
    const source_type = document.getElementById('sourceType').value;
    const category = document.getElementById('sourceCategory').value;
    if (!name || !url || !source_type) {
        alert('Name, URL, and Type are required.');
        return;
    }
    try {
        await api('/sources', {
            method: 'POST',
            body: JSON.stringify({
                name,
                url,
                source_type,
                category: category || undefined,
            }),
            headers: { 'Content-Type': 'application/json' },
        });
        alert('Source added!');
        document.getElementById('sourceModal').remove();
    } catch (e) {
        alert('Failed to add source.');
    }
};

window.deleteSourceById = async () => {
    const id = document.getElementById('deleteSourceId').value;
    if (!id) {
        alert('Source ID required.');
        return;
    }
    try {
        await api(`/sources/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
        });
        alert('Source deleted!');
        document.getElementById('sourceModal').remove();
    } catch (e) {
        alert('Failed to delete source.');
    }
}

window.addCategoryPrompt = async () => {
    const name = window.prompt('New category name:');
    if (!name || !name.trim()) return;
    try {
        await api('/categories', {
            method: 'POST',
            body: JSON.stringify({ name: name.trim() }),
            headers: { 'Content-Type': 'application/json' },
        });
        await fetchCategories();
        renderDashboard();
        alert(`Category added: ${name.trim()}`);
    } catch (e) {
        alert('Failed to add category.');
    }
};

window.deleteCategoryPrompt = async () => {
    const name = window.prompt('Delete category name:');
    if (!name || !name.trim()) return;
    try {
        await api(`/categories/${encodeURIComponent(name.trim())}`, { method: 'DELETE' });
        CATEGORIES = [{ value: '', label: 'All Categories' }];
        await fetchCategories();
        renderDashboard();
        alert(`Category deleted: ${name.trim()}`);
    } catch (e) {
        alert('Failed to delete category.');
    }
};

function renderPanel(config) {
    const module = MODULES[config.module];
    const isMapModule = config.module === 'map';
    
    // Build width/height style for flexible layouts
    let sizeStyle = '';
    if (config.width) {
        sizeStyle = `data-width="${config.width}"`;
    }
    
    let mapFilterDropdown = '';
    // Only show filter dropdown for heatmap type
    if (isMapModule && (!config.mapType || config.mapType === 'heatmap')) {
        // Get current filter selection to show in dropdown
        const currentSeverity = config.filters?.severity || '';
        const currentCategory = config.filters?.category || '';
        const currentFilter = currentSeverity === 'critical' ? 'critical' : currentCategory || '';
        
        mapFilterDropdown = `
            <select class="map-filter-select" onchange="window.updateMapPanelFilter('${config.id}', this.value)">
                <option value="" ${currentFilter === '' ? 'selected' : ''}>All Categories</option>
                <option value="critical" ${currentFilter === 'critical' ? 'selected' : ''}>Critical Only</option>
                ${CATEGORIES.map(c => `<option value="${c.value}" ${currentFilter === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
        `;
    }
    // Feed view toggle and per-feed severity filter
    let feedViewToggle = '';
    let feedSeverityFilter = '';
    if (config.module === 'feed') {
        const view = config.feedView || 'tiled';
        const severity = config.filters?.severity || '';
        feedViewToggle = `
            <select class="feed-view-toggle" onchange="window.setFeedView('${config.id}', this.value)" style="margin-left:8px;">
                <option value="tiled" ${view === 'tiled' ? 'selected' : ''}>Tiled</option>
                <option value="irc" ${view === 'irc' ? 'selected' : ''}>IRC</option>
            </select>
        `;
        // Add per-feed severity filter
        feedSeverityFilter = `
            <select class="feed-filter-severity" onchange="window.setFeedSeverity('${config.id}', this.value)" style="margin-left:8px;">
                <option value="" ${severity === '' || !severity ? 'selected' : ''}>All Severities</option>
                <option value="critical" ${severity === 'critical' ? 'selected' : ''}>🔴 Critical</option>
                <option value="high" ${severity === 'high' ? 'selected' : ''}>🟠 High</option>
                <option value="medium" ${severity === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                <option value="low" ${severity === 'low' ? 'selected' : ''}>🟢 Low</option>
            </select>
        `;
    }
    return `
        <div class="panel draggable" id="${config.id}" data-module="${config.module}"
             ${sizeStyle}
             draggable="true"
             ondragstart="handleDragStart(event, '${config.id}')"
             ondragend="handleDragEnd(event)"
             ondragover="handleDragOver(event)"
             ondrop="handleDrop(event, '${config.id}')">
            <div class="panel-header">
                <span class="panel-title" style="cursor: grab;">
                    <span class="drag-handle">⋮⋮</span>
                    <span>${module.icon}</span>
                    ${config.title || module.name}
                </span>
                <div class="panel-controls">
                    ${module.hasFilters ? renderFilterControls(config) : ''}
                    ${mapFilterDropdown}
                    ${feedViewToggle}
                    ${feedSeverityFilter}
                    <button class="expand-btn" onclick="togglePanelExpand('${config.id}')" title="Expand">
                        ⛶
                    </button>
                    <button class="btn btn-icon" onclick="configurePanelModal('${config.id}')" title="Configure">
                        ⚙️
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="deletePanel('${config.id}')" title="Delete Panel">
                        ✕
                    </button>
                </div>
            </div>
            <div class="panel-content ${isMapModule ? 'map-content' : ''}" id="${config.id}-content">
                <div class="loading"><div class="spinner"></div></div>
            </div>
            ${config.module === 'feed' ? `<div class="panel-footer" id="${config.id}-footer">Loading...</div>` : ''}
            <div class="panel-resize-handle"></div>
        </div>
    `;
}

// Delete panel from dashboard
window.deletePanel = function(panelId) {
    console.log('deletePanel called with panelId:', panelId);
    console.log('Current dashboard:', state.currentDashboard);
    
    if (!state.currentDashboard || !state.currentDashboard.panels) {
        console.error('No current dashboard or panels array');
        alert('Cannot delete panel: No active dashboard');
        return;
    }
    
    if (!confirm('Delete this panel?')) {
        console.log('User cancelled delete');
        return;
    }
    
    const idx = state.currentDashboard.panels.findIndex(p => p.id === panelId);
    console.log('Panel index found:', idx);
    
    if (idx >= 0) {
        state.currentDashboard.panels.splice(idx, 1);
        console.log('Panel removed, re-rendering dashboard');
        renderDashboard();
    } else {
        console.error('Panel not found:', panelId);
        alert('Panel not found');
    }
};

// Feed view setter
window.setFeedView = function(panelId, value) {
    const panel = state.currentDashboard.panels.find(p => p.id === panelId);
    if (!panel) return;
    panel.feedView = value;
    // Force re-render feed panel for layout change
    initializePanel(panel);
};

// Per-feed severity filter handler
window.setFeedSeverity = function(panelId, severity) {
    const panel = state.currentDashboard.panels.find(p => p.id === panelId);
    if (!panel) return;
    if (!panel.filters) panel.filters = {};
    
    if (severity === '') {
        delete panel.filters.severity;
    } else {
        panel.filters.severity = severity;
    }
    
    console.log(`Feed ${panelId} severity filter set to:`, severity);
    // Re-render feed panel with new filter
    initializePanel(panel);
};
// Map panel filter handler
window.updateMapPanelFilter = function(panelId, value) {
    const panel = state.currentDashboard.panels.find(p => p.id === panelId);
    if (!panel) return;
    if (!panel.filters) panel.filters = {};
    
    console.log(`Updating map filter for panel ${panelId} to:`, value);
    
    // Update filter based on dropdown selection
    if (value === 'critical') {
        panel.filters.severity = 'critical';
        delete panel.filters.category;
    } else if (value === '') {
        // All categories - clear all filters
        delete panel.filters.severity;
        delete panel.filters.category;
    } else {
        // Category-based filter
        panel.filters.category = value;
        delete panel.filters.severity;
    }
    
    console.log('Map filter updated:', panel.filters);
    
    // Re-render just the map content
    const content = document.getElementById(`${panelId}-content`);
    if (content) {
        content.innerHTML = `<div id="${panelId}-map" class="map-container"></div>`;
        // Re-initialize the map with new filters
        setTimeout(() => {
            console.log('Reinitializing map with filters:', panel.filters);
            initializePanel(panel);
        }, 100);
    }
};

function renderFilterControls(config) {
    return `
        <input class="filter-input" type="text" placeholder="Search articles..." value="${config.filters?.search || ''}" oninput="filterPanel('${config.id}', 'search', this.value)" style="margin-right: 8px;" />
        <select class="filter-select" onchange="filterPanel('${config.id}', 'category', this.value)">
            ${CATEGORIES.map(c => `<option value="${c.value}" ${config.filters?.category === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
    `;
}

async function initializePanel(config) {
    switch (config.module) {
        case 'feed':
            await initFeedPanel(config);
            break;
        case 'map':
            // Use mapType to determine what to render
            if (config.mapType === 'aircraft') {
                await initAircraftMapPanel(config);
            } else if (config.mapType === 'marine') {
                await initMarineMapPanel(config);
            } else {
                await initMapPanel(config);
            }
            break;
        case 'stats':
            await initStatsPanel(config);
            break;
        case 'chart':
            await initChartPanel(config);
            break;
        case 'alerts':
            await initAlertsPanel(config);
            break;
        case 'starred':
            await initStarredPanel(config);
            break;
        case 'trending':
            await initTrendingPanel(config);
            break;
        case 'aircraft':
            await initAircraftPanel(config);
            break;
        case 'marine':
            await initMarinePanel(config);
            break;
        case 'templates':
            await initTemplatesPanel(config);
            break;
        case 'videos':
            await initVideosPanel(config);
            break;
        case 'web':
            await initWebPanel(config);
            break;
        case 'clock':
            await initClockPanel(config);
            break;
        case 'custom':
            await initCustomPanel(config);
            break;
    }
}

// Aircraft-only map panel
async function initAircraftMapPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    // Embed ADSBexchange website directly
    content.innerHTML = `
        <div class="aircraft-map-container" style="width:100%; height:100%; border: none;">
            <iframe 
                src="https://www.adsbexchange.com/" 
                style="width:100%; height:100%; border:none; border-radius: 4px;"
                allow="geolocation"
                sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
            ></iframe>
        </div>
    `;
}

// Marine-only map panel - displays maritime traffic data
async function initMarineMapPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    // Add filter dropdown for marine type
    const filter = config.marineFilter || 'all';
    content.innerHTML = `
        <div style="margin-bottom:8px;">
            <select id="${config.id}-marine-filter" onchange="window.setMarineMapFilter('${config.id}', this.value)">
                <option value="all" ${filter === 'all' ? 'selected' : ''}>All Vessels</option>
                <option value="commercial" ${filter === 'commercial' ? 'selected' : ''}>Commercial</option>
                <option value="military" ${filter === 'military' ? 'selected' : ''}>Naval</option>
                <option value="alerts" ${filter === 'alerts' ? 'selected' : ''}>High Priority</option>
            </select>
        </div>
        <div id="${config.id}-map" class="map-container"></div>
    `;
    const mapElement = document.getElementById(`${config.id}-map`);
    const map = L.map(mapElement, {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 10,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);
    // Fetch and display maritime articles as vessel location hints
    try {
        const response = await api('/marine/interesting', { method: 'GET' });
        let ships = response.length ? response : [];
        if (filter === 'commercial') ships = ships.filter(s => !s.title.includes('Military') && !s.title.includes('Naval'));
        if (filter === 'military') ships = ships.filter(s => s.title.includes('Military') || s.title.includes('Naval'));
        if (filter === 'alerts') ships = ships.filter(s => s.severity === 'high' || s.severity === 'critical');
        ships.forEach(s => {
            if (s.lat && s.lon) {
                const marker = L.marker([s.lat, s.lon], {
                    icon: L.divIcon({ className: 'marine-marker', html: '⚓', iconSize: [24,24], iconAnchor: [12,12] })
                });
                marker.bindPopup(`<div class="map-popup"><strong>${s.source}</strong><br>${s.title.substring(0,80)}<br><em>${new Date(s.published_at).toLocaleDateString()}</em></div>`);
                marker.addTo(map);
            }
        });
    } catch (e) {
        console.error("Error loading marine data:", e);
    }
    setTimeout(() => map.invalidateSize(), 100);
}

// Expose filter setter
window.setMarineMapFilter = function(panelId, value) {
    const panel = state.currentDashboard.panels.find(p => p.id === panelId);
    if (!panel) return;
    panel.marineFilter = value;
    initializePanel(panel);
};

// ============ FEED PANEL ============

async function initMarinePanel(config) {
    // Fetch marine intelligence articles
    const container = document.getElementById(config.id + '-content');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading maritime intelligence...</div>';
    try {
        // Trigger fresh marine data fetch
        await api('/fetch-now', { method: 'POST' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Fetch marine articles from API
        const response = await api('/marine/interesting', { method: 'GET' });
        const articles = Array.isArray(response) ? response : [];
        
        if (articles.length === 0) {
            container.innerHTML = '<div class="info-box">No maritime articles yet. Data sources updating...</div>';
            return;
        }
        
        container.innerHTML = articles.map(a => `
            <div class="marine-article" style="padding:12px;border-bottom:1px solid var(--border-color);margin-bottom:8px;">
                <div style="font-weight:600;color:var(--accent-color);">${a.source}</div>
                <div style="margin:6px 0;"><strong>${a.title}</strong></div>
                <div style="font-size:0.9em;color:var(--text-secondary);">${new Date(a.published_at).toLocaleDateString()} • Severity: ${a.severity || 'info'}</div>
                <div style="margin-top:6px;font-size:0.9em;">${a.summary || ''}</div>
                <a href="${a.link}" target="_blank" style="color:var(--accent-color);margin-top:6px;display:inline-block;">Read More →</a>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div class="error">Error loading maritime data: ${e.message}</div>`;
        console.error('Marine panel error:', e);
    }
}

async function fetchMarineShips() {
    // Fetch real marine articles from API
    try {
        const articles = await api('/marine/interesting', { method: 'GET' });
        return Array.isArray(articles) ? articles.map(a => ({
            name: a.source,
            lat: a.lat || 0,
            lon: a.lon || 0,
            type: a.severity || 'info',
            destination: a.region || 'unknown',
            speed: 0,
            alert: a.severity === 'critical' || a.severity === 'high'
        })) : [];
    } catch (e) {
        console.error('Error fetching marine data:', e);
        return [];
    }
}

async function initFeedPanel(config) {
    // For aviation/marine categories, trigger a fresh fetch if no articles exist
    if (config.filters?.category && ['aviation', 'marine', 'military'].includes(config.filters.category)) {
        try {
            // Trigger fresh data fetch in background
            await api('/fetch-now', { method: 'POST' });
            console.log(`📡 Fetching fresh ${config.filters.category} data...`);
            // Wait a moment for data to be fetched  
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
            console.log(`Could not trigger fresh fetch: ${e.message}`);
        }
    }
    
    const articles = await loadArticles(config.filters || {});
    const view = config.feedView || 'tiled';
    if (view === 'irc') {
        renderFeedIRCContent(config.id, articles);
    } else {
        renderFeedContent(config.id, articles);
    }
// IRC-style feed rendering
function renderFeedIRCContent(panelId, articles) {
    const content = document.getElementById(`${panelId}-content`);
    const footer = document.getElementById(`${panelId}-footer`);
    if (articles.length === 0) {
        content.innerHTML = `<div class="empty-state"><span style="font-size: 3rem;">📭</span><p>No articles found</p><p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">Data is updating... Check back in a moment<br/>Sources: RSS feeds, Reddit, Bluesky, GDELT</p></div>`;
        if (footer) footer.textContent = '0 articles';
        return;
    }
    content.innerHTML = `<div class="irc-feed-list">${articles.map(article => renderIRCFeedItem(article)).join('')}</div>`;
    if (footer) footer.textContent = `${articles.length} articles`;
}

function renderIRCFeedItem(article) {
    const date = new Date(article.published_at || article.created_at);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timestamp = `${hours}:${minutes}`;
    const articleUrl = article.link || '#';
    const severity = article.severity || 'low';
    const category = article.category || article.source || 'News';
    
    return `<div class="irc-feed-item severity-${severity}">
        <span class="irc-time">${timestamp}</span>
        <span class="irc-source" data-severity="${severity}">&lt;${escapeHtml(article.source || 'Unknown')}&gt;</span>
        <a href="${escapeHtml(articleUrl)}" target="_blank" rel="noopener" class="irc-headline">${escapeHtml(article.title)}</a>
        <span class="irc-category severity-${severity}">${escapeHtml(category)}</span>
    </div>`;
}
}

// Diversify articles to avoid showing many from same source consecutively
function diversifyArticles(articles) {
    if (!articles || articles.length <= 1) return articles;
    
    // Separate critical/high severity articles (always keep them on top)
    const highPriority = articles.filter(a => a.severity === 'critical' || a.severity === 'high');
    const normalPriority = articles.filter(a => a.severity !== 'critical' && a.severity !== 'high');
    
    // Function to interleave by source
    function interleaveBySource(articleList) {
        if (articleList.length <= 1) return articleList;
        
        // Group by source
        const sourceGroups = {};
        articleList.forEach(article => {
            const source = article.source || 'unknown';
            if (!sourceGroups[source]) {
                sourceGroups[source] = [];
            }
            sourceGroups[source].push(article);
        });
        
        // Round-robin through sources
        const result = [];
        const sourceKeys = Object.keys(sourceGroups);
        let maxLength = Math.max(...Object.values(sourceGroups).map(g => g.length));
        
        for (let i = 0; i < maxLength; i++) {
            for (const source of sourceKeys) {
                if (sourceGroups[source][i]) {
                    result.push(sourceGroups[source][i]);
                }
            }
        }
        
        return result;
    }
    
    // Interleave both priority groups separately
    const diversifiedHigh = interleaveBySource(highPriority);
    const diversifiedNormal = interleaveBySource(normalPriority);
    
    // Concatenate with high priority first
    return [...diversifiedHigh, ...diversifiedNormal];
}

function renderFeedContent(panelId, articles) {
    const content = document.getElementById(`${panelId}-content`);
    const footer = document.getElementById(`${panelId}-footer`);
    
    if (articles.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <span style="font-size: 3rem;">📭</span>
                <p>No articles found</p>
            </div>
        `;
        if (footer) footer.textContent = '0 articles';
        return;
    }
    
    // Diversify articles to mix sources better
    const diversifiedArticles = diversifyArticles(articles);
    
    content.innerHTML = `
        <div class="article-list">
            ${diversifiedArticles.map(article => renderArticleItem(article)).join('')}
        </div>
    `;
    
    if (footer) footer.textContent = `${diversifiedArticles.length} articles`;
}

function renderArticleItem(article) {
    const timeAgo = formatTimeAgo(article.published_at || article.created_at);
    const articleUrl = article.link || '#';
    
    return `
        <div class="article-item severity-${article.severity}">
            <a href="${escapeHtml(articleUrl)}" target="_blank" rel="noopener" class="article-title-link" onclick="event.stopPropagation();">
                ${escapeHtml(article.title)}
            </a>
            <div class="article-meta" onclick="openArticle(${article.id})">
                <span class="article-source">
                    <span class="source-dot ${article.source_type}"></span>
                    ${article.source}
                </span>
                ${article.region ? `<span class="article-region">📍 ${article.region}</span>` : ''}
                <span>${timeAgo}</span>
                <span class="severity-indicator">
                    <span class="severity-dot ${article.severity}"></span>
                </span>
            </div>
        </div>
    `;
}

async function refreshFeedPanel(panelId) {
    const panel = state.currentDashboard.panels.find(p => p.id === panelId);
    if (panel && panel.module === 'feed') {
        const articles = await loadArticles(panel.filters || {});
        renderFeedContent(panelId, articles);
    }
}

function filterPanel(panelId, filterType, value) {
    const panel = state.currentDashboard.panels.find(p => p.id === panelId);
    if (!panel) return;
    
    if (!panel.filters) panel.filters = {};
    panel.filters[filterType] = value;
    
    refreshFeedPanel(panelId);
    // syncMapWithFeedFilters();
}

// Sync map with current feed filters
async function syncMapWithFeedFilters() {
    // Find the feed panel with filters (usually the first one)
    const feedPanel = state.currentDashboard.panels.find(p => p.module === 'feed' && p.filters);
    const mapPanel = state.currentDashboard.panels.find(p => p.module === 'map');
    
    if (!feedPanel || !mapPanel || !state.map) return;
    
    // Update map with feed filters
    const filters = { ...feedPanel.filters };
    const data = await loadHeatmapData(filters);
    
    // Clear existing layers
    if (state.heatLayer) {
        state.map.removeLayer(state.heatLayer);
        state.heatLayer = null;
    }
    
    // Remove existing markers
    state.map.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) {
            state.map.removeLayer(layer);
        }
    });
    
    if (data.points && data.points.length > 0) {
        // Recreate heat layer
        const heatData = data.points.map(p => [p.lat, p.lon, p.intensity || 0.5]);
        state.heatLayer = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            gradient: {
                0.2: '#3b82f6',
                0.4: '#22c55e',
                0.6: '#f59e0b',
                0.8: '#ef4444',
                1.0: '#ff0000',
            },
        }).addTo(state.map);
        
        // Recreate markers
        data.points.forEach(p => {
            const color = p.severity === 'critical' ? '#ef4444' 
                : p.severity === 'high' ? '#f59e0b'
                : p.severity === 'medium' ? '#3b82f6'
                : '#22c55e';
            const radius = p.severity === 'critical' ? 8 : p.severity === 'high' ? 6 : 5;
            
            const marker = L.circleMarker([p.lat, p.lon], {
                radius: radius,
                fillColor: color,
                color: '#fff',
                weight: 1,
                fillOpacity: 0.85,
            }).addTo(state.map);
            
            const popupContent = `
                <div class="map-popup">
                    <div class="map-popup-title">${escapeHtml(p.title)}</div>
                    <div class="map-popup-meta">
                        <span class="map-popup-severity ${p.severity}">${p.severity}</span>
                        <span>${p.source || 'Unknown'}</span>
                    </div>
                </div>
            `;
            marker.bindPopup(popupContent);
        });
    }
}

// ============ MAP PANEL ============

// Store last used filters for map
let lastMapFilters = {};

async function initMapPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    content.innerHTML = `<div id="${config.id}-map" class="map-container"></div>`;
    
    // Initialize Leaflet map
    const mapElement = document.getElementById(`${config.id}-map`);
    const map = L.map(mapElement, {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 10,
    });
    
    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);
    
    // Store map reference
    state.map = map;
    
    // Use panel filters if present, default to empty object
    const panelFilters = config.filters && typeof config.filters === 'object' ? config.filters : {};
    lastMapFilters = { ...panelFilters };
    
    console.log('initMapPanel: Using filters:', panelFilters);

    // Prepare filters for API call (don't pass undefined values)
    let filters = {};
    if (panelFilters.severity) filters.severity = panelFilters.severity;
    if (panelFilters.category) filters.category = panelFilters.category;

    // Load heatmap data with filters (only show articles matching filters)
    const data = await loadHeatmapData(filters);
    
    if (data.points && data.points.length > 0) {
        // Create heat layer
        const heatData = data.points.map(p => [p.lat, p.lon, p.intensity]);
        state.heatLayer = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            gradient: {
                0.2: '#3b82f6',
                0.4: '#22c55e',
                0.6: '#f59e0b',
                0.8: '#ef4444',
                1.0: '#ff0000',
            },
        }).addTo(map);
        
        // Add clickable markers for all items with location
        data.points.forEach(p => {
            const color = p.severity === 'critical' ? '#ef4444' 
                : p.severity === 'high' ? '#f59e0b'
                : p.severity === 'medium' ? '#3b82f6'
                : '#22c55e';
            const radius = p.severity === 'critical' ? 8 : p.severity === 'high' ? 6 : 5;
            
            const marker = L.circleMarker([p.lat, p.lon], {
                radius: radius,
                fillColor: color,
                color: '#fff',
                weight: 1,
                fillOpacity: 0.85,
            }).addTo(map);
            
            // Create clickable popup with link to story
            const popupContent = `
                <div class="map-popup">
                    <div class="map-popup-title">${escapeHtml(p.title)}</div>
                    <div class="map-popup-meta">
                        <span class="map-popup-severity ${p.severity}">${p.severity}</span>
                        <span>${p.region || ''}</span>
                    </div>
                    <a href="${escapeHtml(p.link || '#')}" target="_blank" rel="noopener" class="map-popup-link">
                        Open Story →
                    </a>
                </div>
            `;
            marker.bindPopup(popupContent, {
                maxWidth: 280,
                className: 'dark-popup'
            });
        });

        if (data.hotspots && data.hotspots.length > 0) {
            data.hotspots.forEach(h => {
                const pulseSize = Math.min(48, Math.max(16, Math.round(12 + h.hotspot_score)));
                const pulseIcon = L.divIcon({
                    className: 'hotspot-pulse-icon',
                    html: `<div class="hotspot-pulse" style="width:${pulseSize}px;height:${pulseSize}px;"></div>`,
                    iconSize: [pulseSize, pulseSize],
                    iconAnchor: [Math.round(pulseSize / 2), Math.round(pulseSize / 2)],
                });
                const hotspotMarker = L.marker([h.lat, h.lon], { icon: pulseIcon }).addTo(map);
                hotspotMarker.bindPopup(`
                    <div class="map-popup">
                        <div class="map-popup-title">${escapeHtml(h.area)}</div>
                        <div class="map-popup-meta">
                            <span>Mentions: ${h.mentions}</span>
                            <span>Heat: ${h.hotspot_score}</span>
                        </div>
                    </div>
                `, { maxWidth: 260, className: 'dark-popup' });
            });
        }
    }
    
    // Invalidate size after render
    setTimeout(() => map.invalidateSize(), 100);
    
    // Load aircraft markers on map
    await loadAircraftOnMap();
    
    // Auto-refresh aircraft every 30 seconds
    if (state.aircraftRefreshInterval) {
        clearInterval(state.aircraftRefreshInterval);
    }
    state.aircraftRefreshInterval = setInterval(() => loadAircraftOnMap(), 30000);
}

async function loadAircraftOnMap() {
    if (!state.map) return;

    // Only show aircraft if the current map panel's filters/category are aviation/aircraft or dashboard is aviation
    const mapPanel = (state.currentDashboard && state.currentDashboard.panels)
        ? state.currentDashboard.panels.find(p => p.module === 'map')
        : null;
    const mapCategory = mapPanel && mapPanel.filters && mapPanel.filters.category;
    const dashboardName = state.currentDashboard && state.currentDashboard.name ? state.currentDashboard.name.toLowerCase() : '';
    const showAircraft = (mapCategory && ["aviation", "aircraft", "flight"].includes(mapCategory.toLowerCase())) || dashboardName.includes("aviation");
    if (!showAircraft) {
        // Remove aircraft layer if present
        if (state.aircraftLayer) {
            state.map.removeLayer(state.aircraftLayer);
            state.aircraftLayer = null;
        }
        return;
    }

    try {
        const aircraft = await api(`/aircraft/interesting?region=${currentAircraftRegion}`);
        allAircraftData = aircraft || [];

        // Apply filter
        const filteredAircraft = filterAircraft(allAircraftData);

        // Clear previous aircraft layer
        if (state.aircraftLayer) {
            state.map.removeLayer(state.aircraftLayer);
        }

        if (!filteredAircraft || filteredAircraft.length === 0) return;

        // Create new layer group
        state.aircraftLayer = L.layerGroup();

        filteredAircraft.forEach(a => {
            if (!a.latitude || !a.longitude) return;

            const isEmergency = a.aircraft_category === 'emergency';
            const isMilitary = a.aircraft_category === 'military';
            const color = isEmergency ? '#ff0000' : isMilitary ? '#f59e0b' : '#3b82f6';

            // Create custom aircraft icon
            const icon = L.divIcon({
                className: 'aircraft-marker',
                html: `<div class="aircraft-icon ${isEmergency ? 'emergency' : ''}" style="transform: rotate(${a.heading || 0}deg);">✈</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });

            const marker = L.marker([a.latitude, a.longitude], { icon });

            const popupContent = `
                <div class="map-popup aircraft-popup">
                    <div class="map-popup-title">${a.callsign || 'Unknown'}</div>
                    <div class="aircraft-popup-details">
                        <div>ICAO: ${a.icao24}</div>
                        <div>Country: ${a.origin_country || 'Unknown'}</div>
                        <div>Alt: ${a.altitude ? a.altitude.toLocaleString() + 'ft' : 'N/A'}</div>
                        <div>Speed: ${a.velocity ? a.velocity + 'kts' : 'N/A'}</div>
                        ${a.squawk ? `<div class="squawk">Squawk: ${a.squawk}</div>` : ''}
                    </div>
                    <a href="${a.link || '#'}" target="_blank" rel="noopener" class="map-popup-link">
                        Track on ADSBexchange →
                    </a>
                </div>
            `;
            marker.bindPopup(popupContent, { maxWidth: 250, className: 'dark-popup' });

            marker.addTo(state.aircraftLayer);
        });

        state.aircraftLayer.addTo(state.map);

        // Also update aircraft panel if it exists
        const panel = state.panelConfigs.find(p => p.module === 'aircraft');
        if (panel) {
            renderAircraftContent(panel.id, filteredAircraft);
        }

    } catch (error) {
        console.error('Failed to load aircraft on map:', error);
    }
}

// ============ STATS PANEL ============

async function initStatsPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    const stats = state.stats;
    
    content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-value">${stats.total_articles || 0}</span>
                <span class="stat-label">Total Articles</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.last_24h || 0}</span>
                <span class="stat-label">Last 24 Hours</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" style="color: var(--severity-critical)">
                    ${stats.by_severity?.critical || 0}
                </span>
                <span class="stat-label">Critical</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" style="color: var(--severity-high)">
                    ${stats.by_severity?.high || 0}
                </span>
                <span class="stat-label">High</span>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 10px;">By Source Type</h4>
            ${Object.entries(stats.by_source_type || {}).map(([type, count]) => `
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                    <span class="source-type-badge ${type}">${type.toUpperCase()}</span>
                    <span>${count}</span>
                </div>
            `).join('')}
        </div>
        
        <div style="margin-top: 20px;">
            <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 10px;">By Category</h4>
            ${Object.entries(stats.by_category || {}).map(([cat, count]) => `
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                    <span>${cat}</span>
                    <span>${count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ============ CHART PANEL ============

async function initChartPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    content.innerHTML = `<canvas id="${config.id}-chart"></canvas>`;
    
    const data = await loadTimelineData();
    
    const ctx = document.getElementById(`${config.id}-chart`).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Articles',
                data: data.map(d => d.count),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                    },
                    ticks: {
                        color: '#94a3b8',
                    },
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                    },
                    ticks: {
                        color: '#94a3b8',
                    },
                },
            },
        },
    });
}

// ============ ALERTS PANEL ============

async function initAlertsPanel(config) {
    const articles = await loadArticles({ severity: 'critical' });
    renderFeedContent(config.id, articles);
}

// ============ STARRED PANEL ============

async function initStarredPanel(config) {
    const articles = await loadArticles({ starred: true });
    renderFeedContent(config.id, articles);
}

// ============ TRENDING PANEL ============

async function initTrendingPanel(config) {
    try {
        const alerts = await api('/trending');
        renderTrendingContent(config.id, alerts);
    } catch (error) {
        console.error('Failed to load trending alerts:', error);
        const content = document.getElementById(`${config.id}-content`);
        content.innerHTML = `<div class="empty-state"><span style="font-size: 3rem;">🔥</span><p>Error loading trending alerts</p></div>`;
    }
}

function renderTrendingContent(panelId, alerts) {
    const content = document.getElementById(`${panelId}-content`);
    const footer = document.getElementById(`${panelId}-footer`);
    
    if (!alerts || alerts.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <span style="font-size: 3rem;">📊</span>
                <p>No trending alerts detected</p>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">Spikes auto-detected every 10 min</p>
            </div>
        `;
        if (footer) footer.textContent = 'No active alerts';
        return;
    }
    
    content.innerHTML = `
        <div class="trending-list">
            ${alerts.map(alert => renderTrendingAlert(alert)).join('')}
        </div>
    `;
    
    if (footer) footer.textContent = `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`;
}

function renderTrendingAlert(alert) {
    const severityIcon = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : '📈';
    const typeLabel = {
        'region_spike': '📍 Regional Spike',
        'keyword_surge': '🔑 Keyword Surge', 
        'new_conflict': '⚔️ New Conflict Zone'
    }[alert.alert_type] || alert.alert_type;
    
    const location = alert.region || alert.country || 'Unknown';
    const percentChange = alert.spike_percentage ? `+${alert.spike_percentage.toFixed(0)}%` : '';
    
    return `
        <div class="trending-alert severity-${alert.severity}" onclick="showTrendingDetails(${alert.id})">
            <div class="trending-header">
                <span class="trending-icon">${severityIcon}</span>
                <span class="trending-type">${typeLabel}</span>
                ${percentChange ? `<span class="trending-change">${percentChange}</span>` : ''}
            </div>
            <div class="trending-location">${location}</div>
            ${alert.keyword ? `<div class="trending-keyword">Keyword: "${alert.keyword}"</div>` : ''}
            <div class="trending-stats">
                ${alert.article_count} articles (was ${alert.previous_count || 0})
            </div>
            <div class="trending-actions">
                <button class="btn-small" onclick="event.stopPropagation(); acknowledgeTrendingAlert(${alert.id})">Dismiss</button>
                <button class="btn-small" onclick="event.stopPropagation(); focusOnRegion('${location}')">Focus</button>
            </div>
        </div>
    `;
}

async function acknowledgeTrendingAlert(alertId) {
    try {
        await api(`/trending/${alertId}/acknowledge`, { method: 'POST' });
        // Refresh trending panel
        const panel = state.panelConfigs.find(p => p.module === 'trending');
        if (panel) await initTrendingPanel(panel);
        showNotification('Alert dismissed', 'success');
    } catch (error) {
        console.error('Failed to acknowledge alert:', error);
    }
}

async function showTrendingDetails(alertId) {
    // Show articles related to this trending alert
    try {
        const articles = await loadArticles({ limit: 10 });
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'trendingDetailsModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-height:80vh;overflow-y:auto;">
                <div style="font-size:1.3rem;font-weight:600;margin-bottom:12px;">Trending Alert Details</div>
                <div style="max-height:60vh;overflow-y:auto;">
                    ${articles.map(a => `
                        <div style="padding:8px;border-bottom:1px solid var(--border-color);margin-bottom:8px;">
                            <strong>${a.title}</strong><br>
                            <small>${a.source} - ${new Date(a.published_at).toLocaleDateString()}</small><br>
                            <a href="${a.link}" target="_blank" style="color:var(--accent-color);">Read More →</a>
                        </div>
                    `).join('')}
                </div>
                <button onclick="document.getElementById('trendingDetailsModal').remove()" style="padding:8px 18px;margin-top:12px;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        showNotification('Error loading trend details: ' + error.message, 'error');
    }
}

function focusOnRegion(region) {
    // Focus map on this region
    showNotification(`Focusing on ${region}...`, 'info');
    // Would need geocoding or region center lookup
}

// ============ AIRCRAFT PANEL ============

let currentAircraftRegion = 'europe';
let aircraftFilter = 'all'; // 'all', 'military', 'emergency'
let allAircraftData = []; // Store unfiltered data

async function initAircraftPanel(config) {
    try {
        const data = await api(`/aircraft/interesting?region=${currentAircraftRegion}`);
        allAircraftData = data || [];
        renderAircraftContent(config.id, filterAircraft(allAircraftData));
    } catch (error) {
        console.error('Failed to load aircraft:', error);
        const content = document.getElementById(`${config.id}-content`);
        content.innerHTML = `<div class="empty-state"><span style="font-size: 3rem;">✈️</span><p>Aircraft tracking unavailable</p><p style="font-size: 0.8rem; color: var(--text-secondary);">OpenSky Network API may be unavailable</p></div>`;
    }
}

function filterAircraft(aircraft) {
    if (!aircraft) return [];
    if (aircraftFilter === 'all') return aircraft;
    
    if (aircraftFilter === 'military') {
        return aircraft.filter(a => a.aircraft_category === 'military');
    }
    
    if (aircraftFilter === 'emergency') {
        const emergencySquawks = ['7500', '7600', '7700'];
        return aircraft.filter(a => 
            a.aircraft_category === 'emergency' || 
            emergencySquawks.includes(a.squawk)
        );
    }
    
    return aircraft;
}

function setAircraftFilter(filter) {
    aircraftFilter = filter;
    const panel = state.panelConfigs.find(p => p.module === 'aircraft');
    if (panel) {
        renderAircraftContent(panel.id, filterAircraft(allAircraftData));
    }
    // Also update map markers
    loadAircraftOnMap();
}

function renderAircraftContent(panelId, aircraft) {
    const content = document.getElementById(`${panelId}-content`);
    const footer = document.getElementById(`${panelId}-footer`);
    
    const regionSelector = `
        <div class="aircraft-controls">
            <select id="aircraftRegion" onchange="changeAircraftRegion(this.value, '${panelId}')" class="form-select">
                <option value="usa" ${currentAircraftRegion === 'usa' ? 'selected' : ''}>🇺🇸 USA</option>
                <option value="europe" ${currentAircraftRegion === 'europe' ? 'selected' : ''}>🇪🇺 Europe</option>
                <option value="middle_east" ${currentAircraftRegion === 'middle_east' ? 'selected' : ''}>🌍 Middle East</option>
                <option value="asia" ${currentAircraftRegion === 'asia' ? 'selected' : ''}>🌏 Asia Pacific</option>
                <option value="global" ${currentAircraftRegion === 'global' ? 'selected' : ''}>🌐 Global</option>
            </select>
            <div class="aircraft-filter-btns">
                <button class="btn-filter ${aircraftFilter === 'all' ? 'active' : ''}" onclick="setAircraftFilter('all')">All</button>
                <button class="btn-filter ${aircraftFilter === 'military' ? 'active' : ''}" onclick="setAircraftFilter('military')">🎖️ Military</button>
                <button class="btn-filter ${aircraftFilter === 'emergency' ? 'active' : ''}" onclick="setAircraftFilter('emergency')">🚨 7500/7600/7700</button>
            </div>
            <button class="btn-small" onclick="refreshAircraftData()">🔄</button>
        </div>
    `;
    
    if (!aircraft || aircraft.length === 0) {
        content.innerHTML = `
            ${regionSelector}
            <div class="empty-state">
                <span style="font-size: 3rem;">✈️</span>
                <p>No military/interesting aircraft detected</p>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">Try a different region or refresh</p>
            </div>
        `;
        if (footer) footer.textContent = 'Scanning...';
        return;
    }
    
    // Group by category
    const byCategory = {};
    aircraft.forEach(a => {
        const cat = a.aircraft_category || 'military';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(a);
    });
    
    content.innerHTML = `
        ${regionSelector}
        <div class="aircraft-list">
            ${aircraft.map(a => renderAircraftItem(a)).join('')}
        </div>
    `;
    
    if (footer) footer.textContent = `${aircraft.length} aircraft tracked`;
}

function renderAircraftItem(aircraft) {
    const categoryIcons = {
        'military': '🎖️',
        'surveillance': '👁️',
        'emergency': '🚨',
        'government': '🏛️',
        'unknown': '❓'
    };
    const icon = categoryIcons[aircraft.aircraft_category] || '✈️';
    const isEmergency = aircraft.aircraft_category === 'emergency';
    
    return `
        <a href="${aircraft.link || '#'}" target="_blank" rel="noopener" class="aircraft-item ${aircraft.is_interesting ? 'interesting' : ''} ${isEmergency ? 'emergency' : ''}">
            <div class="aircraft-header">
                <span class="aircraft-icon">${icon}</span>
                <span class="aircraft-callsign">${aircraft.callsign || 'N/A'}</span>
                <span class="aircraft-country">${aircraft.origin_country || 'Unknown'}</span>
            </div>
            <div class="aircraft-title">${aircraft.title || ''}</div>
            <div class="aircraft-details">
                <span>ICAO: ${aircraft.icao24}</span>
                <span>Alt: ${aircraft.altitude ? aircraft.altitude.toLocaleString() + 'ft' : 'N/A'}</span>
                <span>Spd: ${aircraft.velocity ? aircraft.velocity + 'kts' : 'N/A'}</span>
                ${aircraft.squawk ? `<span class="squawk">SQ: ${aircraft.squawk}</span>` : ''}
            </div>
            ${aircraft.latitude && aircraft.longitude ? `
                <div class="aircraft-coords">
                    📍 ${aircraft.latitude.toFixed(3)}, ${aircraft.longitude.toFixed(3)}
                </div>
            ` : ''}
        </a>
    `;
}

async function changeAircraftRegion(region, panelId) {
    currentAircraftRegion = region;
    const panel = state.panelConfigs.find(p => p.module === 'aircraft');
    if (panel) {
        await initAircraftPanel(panel);
    }
}

async function refreshAircraftData() {
    try {
        showNotification('Scanning for aircraft...', 'info');
        await api('/aircraft/fetch', { method: 'POST' });
        const panel = state.panelConfigs.find(p => p.module === 'aircraft');
        if (panel) await initAircraftPanel(panel);
        showNotification('Aircraft data refreshed', 'success');
    } catch (error) {
        console.error('Failed to refresh aircraft:', error);
        showNotification('Failed to refresh aircraft data', 'error');
    }
}

// ============ TEMPLATES PANEL ============

async function initTemplatesPanel(config) {
    try {
        const templates = await api('/templates');
        renderTemplatesContent(config.id, templates);
    } catch (error) {
        console.error('Failed to load templates:', error);
        const content = document.getElementById(`${config.id}-content`);
        content.innerHTML = `<div class="empty-state"><span style="font-size: 3rem;">📋</span><p>Failed to load templates</p></div>`;
    }
}

function renderTemplatesContent(panelId, templates) {
    const content = document.getElementById(`${panelId}-content`);
    const footer = document.getElementById(`${panelId}-footer`);
    
    content.innerHTML = `
        <div class="templates-list">
            ${templates.map(t => renderTemplateCard(t)).join('')}
        </div>
    `;
    
    if (footer) footer.textContent = `${templates.length} available templates`;
}

async function initVideosPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    const hotArticles = await loadArticles({ severity: 'high', limit: 12 });
    const videoCandidates = hotArticles.filter(a => {
        const link = (a.link || '').toLowerCase();
        return link.includes('youtube.com') || link.includes('youtu.be') || link.includes('vimeo.com') || link.includes('rumble.com');
    });

    if (!videoCandidates.length) {
        content.innerHTML = `<div class="empty-state"><span style="font-size: 2rem;">🎥</span><p>No hot video links found yet</p></div>`;
        return;
    }

    content.innerHTML = `<div class="article-list">${videoCandidates.map(a => `
        <div class="article-item severity-${a.severity}">
            <a href="${escapeHtml(a.link || '#')}" target="_blank" rel="noopener" class="article-title-link">${escapeHtml(a.title)}</a>
            <div class="article-meta">
                <span>${escapeHtml(a.source || 'unknown')}</span>
                <span>${escapeHtml(a.region || 'Global')}</span>
                <span class="severity-indicator">
                    <span class="severity-dot ${a.severity}"></span>
                </span>
            </div>
        </div>
    `).join('')}</div>`;
}

async function initWebPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    
    // Get saved URL from localStorage or use default
    const savedUrl = localStorage.getItem(`webModuleUrl_${config.id}`);
    const targetUrl = savedUrl || (config.url && String(config.url).trim()) || 'https://globe.adsbexchange.com/';
    
    content.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0 8px;">
                <div style="font-size:12px;color:var(--text-secondary);">Embedded: ${escapeHtml(targetUrl)}</div>
                <button 
                    onclick="openWebModuleConfig('${config.id}')" 
                    style="padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;"
                    title="Configure web module URL"
                >⚙️ Settings</button>
            </div>
            <iframe src="${escapeHtml(targetUrl)}" style="flex:1;border:1px solid var(--border-color);border-radius:8px;background:#000;min-height:320px;" referrerpolicy="no-referrer"></iframe>
        </div>
    `;
}

// ============ CLOCK PANEL ============

async function initClockPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    
    function updateClocks() {
        const now = new Date();
        
        const clocks = [
            { zone: 'UTC', offset: 0, label: 'UTC (Universal)' },
            { zone: 'CST', offset: -6, label: 'CST (Central)' },
            { zone: 'EST', offset: -5, label: 'EST (Eastern)' },
            { zone: 'PST', offset: -8, label: 'PST (Pacific)' },
            { zone: 'GMT', offset: 0, label: 'GMT (London)' },
            { zone: 'CET', offset: 1, label: 'CET (Paris)' },
            { zone: 'MSK', offset: 3, label: 'MSK (Moscow)' },
            { zone: 'JST', offset: 9, label: 'JST (Tokyo)' },
            { zone: 'AEST', offset: 10, label: 'AEST (Sydney)' },
        ];
        
        const clocksHtml = clocks.map(clock => {
            const localTime = new Date(now.getTime() + (clock.offset * 60 * 60 * 1000));
            const hours = localTime.getUTCHours().toString().padStart(2, '0');
            const minutes = localTime.getUTCMinutes().toString().padStart(2, '0');
            const seconds = localTime.getUTCSeconds().toString().padStart(2, '0');
            
            return `
                <div class="clock-item">
                    <div class="clock-zone">${clock.label}</div>
                    <div class="clock-time">${hours}:${minutes}:${seconds}</div>
                </div>
            `;
        }).join('');
        
        content.innerHTML = `
            <div class="clock-grid">
                ${clocksHtml}
            </div>
        `;
    }
    
    updateClocks();
    setInterval(updateClocks, 1000);
}

// Custom panel for displaying interesting flights and other custom data
async function initCustomPanel(config) {
    const content = document.getElementById(`${config.id}-content`);
    
    if (!config.apiEndpoint) {
        content.innerHTML = `<div style="padding:20px; color:var(--text-muted);">No API endpoint configured for this panel</div>`;
        return;
    }
    
    // Add search UI if this is an aircraft endpoint
    const isAircraft = config.apiEndpoint.includes('/aircraft/');
    let searchHTML = '';
    if (isAircraft) {
        searchHTML = `
            <div style="padding:12px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); display:flex; gap:8px; align-items:center;">
                <input type="text" id="aircraft-search" placeholder="Search by callsign, ICAO hex, or squawk..." 
                       style="flex:1; padding:8px; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-primary); border-radius:4px;"
                       onkeyup="searchAircraft('${config.id}', event)" />
                <button onclick="searchAircraft('${config.id}', {key:'Enter'})" style="padding:8px 16px; background:var(--accent-primary); color:#fff; border:none; border-radius:4px; cursor:pointer;">🔍</button>
            </div>
        `;
    }
    
    content.innerHTML = searchHTML + '<div id="custom-data-list" style="overflow-y:auto; height:calc(100% - 50px);"></div>';
    
    // Load initial data
    loadCustomData(config.id, config.apiEndpoint);
}

async function searchAircraft(panelId, event) {
    if (event.key && event.key !== 'Enter') return;
    
    const searchInput = document.getElementById('aircraft-search');
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        alert('Search query must be at least 2 characters');
        return;
    }
    
    try {
        const results = await api(`/aircraft/search?q=${encodeURIComponent(query)}&region=global`);
        displayAircraftSearch(panelId, results);
    } catch (e) {
        console.error('Aircraft search error:', e);
    }
}

function displayAircraftSearch(panelId, results) {
    const listDiv = document.getElementById('custom-data-list');
    
    if (!results.results || results.results.length === 0) {
        listDiv.innerHTML = `<div style="padding:20px; color:var(--text-muted); text-align:center;">No aircraft found matching "${results.query}"</div>`;
        return;
    }
    
    const html = `
        <div style="padding:12px; overflow-y:auto; height:100%;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">Found ${results.count} matching aircraft</div>
            <table style="width:100%; border-collapse: collapse; font-size:0.80rem; font-family:monospace;">
                <thead style="position:sticky; top:0; background:var(--bg-tertiary); border-bottom:2px solid var(--border-color);">
                    <tr>
                        <th style="padding:8px; text-align:left; color:var(--severity-critical);">CALLSIGN</th>
                        <th style="padding:8px; text-align:left; color:var(--severity-high);">ICAO</th>
                        <th style="padding:8px; text-align:right; color:#0ea5e9;">SQUAWK</th>
                        <th style="padding:8px; text-align:right; color:#39ff14;">ALT FT</th>
                        <th style="padding:8px; text-align:left; color:var(--text-muted);">COUNTRY</th>
                        <th style="padding:8px; text-align:center; color:#f7b32b;">MONITOR</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.results.map(item => `
                        <tr style="border-bottom:1px solid var(--border-color); transition:all 0.2s; hover:background:var(--bg-hover);">
                            <td style="padding:8px; color:var(--severity-critical); font-weight:700;">${escapeHtml(item.callsign || item.name || 'N/A')}</td>
                            <td style="padding:8px; color:var(--severity-high); font-size:0.75rem;">${escapeHtml(item.icao24 || 'N/A')}</td>
                            <td style="padding:8px; text-align:right; color:#0ea5e9;">${escapeHtml(item.squawk || 'N/A')}</td>
                            <td style="padding:8px; text-align:right; color:#39ff14;">${item.altitude ? item.altitude.toLocaleString() : 'N/A'}</td>
                            <td style="padding:8px; color:var(--text-muted); font-size:0.75rem;">${escapeHtml(item.origin_country || 'Unknown')}</td>
                            <td style="padding:8px; text-align:center;">
                                <button onclick="watchAircraft('${item.callsign || ''}', '${item.squawk || ''}')" style="padding:4px 8px; background:var(--accent-primary); color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:0.75rem;">👁️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    listDiv.innerHTML = html;
}

async function loadCustomData(panelId, endpoint) {
    try {
        const data = await api(endpoint);
        const items = Array.isArray(data) ? data : data.data || [];
        
        const listDiv = document.getElementById('custom-data-list');
        
        if (items.length === 0) {
            listDiv.innerHTML = `<div style="padding:20px; color:var(--text-muted);">No data available</div>`;
            return;
        }
        
        // Display interesting flights as table/list
        const html = `
            <div style="padding:12px; overflow-y:auto; height:100%;">
                <table style="width:100%; border-collapse: collapse; font-size:0.85rem; font-family:monospace;">
                    <thead style="position:sticky; top:0; background:var(--bg-tertiary); border-bottom:2px solid var(--border-color);">
                        <tr>
                            <th style="padding:8px; text-align:left; color:var(--severity-critical);">CALLSIGN</th>
                            <th style="padding:8px; text-align:left; color:var(--severity-high);">AIRCRAFT</th>
                            <th style="padding:8px; text-align:right; color:#0ea5e9;">ALT FT</th>
                            <th style="padding:8px; text-align:right; color:#39ff14;">SPD KT</th>
                            <th style="padding:8px; text-align:left; color:var(--text-muted);">ORIGIN</th>
                            <th style="padding:8px; text-align:left; color:#f7b32b;">INTEREST</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr style="border-bottom:1px solid var(--border-color); transition:all 0.2s;">
                                <td style="padding:8px; color:var(--severity-critical); font-weight:700;">${escapeHtml(item.callsign || item.name || 'N/A')}</td>
                                <td style="padding:8px; color:var(--text-secondary);">${escapeHtml(item.aircraft_type || 'Unknown')}</td>
                                <td style="padding:8px; text-align:right; color:#0ea5e9;">${item.altitude ? item.altitude.toLocaleString() : 'N/A'}</td>
                                <td style="padding:8px; text-align:right; color:#39ff14;">${item.velocity ? Math.round(item.velocity) : 'N/A'}</td>
                                <td style="padding:8px; color:var(--text-muted);">${escapeHtml(item.origin_country || 'Unknown')}</td>
                                <td style="padding:8px; color:#f7b32b; font-size:0.75rem;">${escapeHtml(item.aircraft_category || item.interest_reason || 'Military')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        listDiv.innerHTML = html;
    } catch (e) {
        console.error('Failed to load custom data:', e);
        document.getElementById('custom-data-list').innerHTML = `<div style="padding:20px; color:#ef4444;">Failed to load data: ${e.message}</div>`;
    }
}

async function watchAircraft(callsign, squawk) {
    try {
        const result = await api('/aircraft/watch', {
            method: 'POST',
            body: JSON.stringify({ callsign, squawk, alert_enabled: true }),
            headers: { 'Content-Type': 'application/json' },
        });
        alert(`Now watching: ${callsign || squawk}\n\nAlerts will be enabled when squawk comes online.`);
    } catch (e) {
        alert('Failed to add aircraft to watch list');
    }
}

function renderTemplateCard(template) {
    return `
        <div class="template-card">
            <div class="template-name">${template.name}</div>
            <div class="template-description">${template.description}</div>
            <div class="template-info">
                <span>${template.panels} panels</span>
                <span>${template.layout}</span>
            </div>
            <div class="template-categories">
                ${template.categories.slice(0, 4).map(c => `<span class="category-tag">${c}</span>`).join('')}
                ${template.categories.length > 4 ? `<span class="category-tag">+${template.categories.length - 4}</span>` : ''}
            </div>
            <button class="btn-primary" onclick="applyTemplate('${template.id}')">Apply Template</button>
        </div>
    `;
}

async function applyTemplate(templateId) {
    try {
        const template = await api(`/templates/${templateId}`);
        
        // Update layout
        state.selectedLayout = template.layout;
        
        // Create panel configs from template
        const panelCount = template.panels;
        state.panelConfigs = [];
        
        template.categories.forEach((category, i) => {
            if (i >= panelCount) return;
            
            // Map category to module
            let module = 'feed';
            if (category === 'map') module = 'map';
            else if (category === 'trending') module = 'trending';
            else if (category === 'aircraft') module = 'aircraft';
            
            state.panelConfigs.push({
                id: `panel-${i}`,
                module: module,
                title: MODULES[module]?.name || category,
                filters: category !== 'map' && category !== 'trending' && category !== 'aircraft' 
                    ? { category: category.toLowerCase() } 
                    : {}
            });
        });
        
        // Re-render dashboard
        renderDashboard(state.selectedLayout);
        showNotification(`Applied template: ${template.name}`, 'success');
        closeModal('dashboardConfigModal');
    } catch (error) {
        console.error('Failed to apply template:', error);
        showNotification('Failed to apply template', 'error');
    }
}

// ============ ARTICLE MODAL ============

async function openArticle(articleId) {
    try {
        const article = await api(`/articles/${articleId}`);
        
        const titleEl = document.getElementById('articleTitle');
        titleEl.textContent = article.title;
        titleEl.href = article.link || '#';
        document.getElementById('articleLink').href = article.link || '#';
        
        document.getElementById('articleMeta').innerHTML = `
            <div style="display: flex; gap: 16px; margin-bottom: 16px; color: var(--text-secondary);">
                <span class="source-type-badge ${article.source_type}">${article.source_type}</span>
                <span>${article.source}</span>
                <span>${formatTimeAgo(article.published_at || article.created_at)}</span>
                <span class="severity-indicator">
                    <span class="severity-dot ${article.severity}"></span>
                </span>
                ${article.region ? `<span>📍 ${article.region}</span>` : ''}
            </div>
        `;
        
        document.getElementById('articleContent').innerHTML = `
            <p style="line-height: 1.6; color: var(--text-primary);">
                ${escapeHtml(article.summary || article.content || 'No content available')}
            </p>
            ${article.locations && article.locations.length > 0 ? `
                <div style="margin-top: 16px;">
                    <strong>Locations mentioned:</strong> ${article.locations.join(', ')}
                </div>
            ` : ''}
        `;
        
        // Store current article ID for severity updates
        document.getElementById('articleModal').dataset.articleId = articleId;
        
        openModal('articleModal');
        
        // Mark as read
        await api(`/articles/${articleId}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_read: true }),
        });
        
    } catch (error) {
        console.error('Failed to load article:', error);
    }
}

async function setSeverity(severity) {
    const articleId = document.getElementById('articleModal').dataset.articleId;
    if (!articleId) return;
    
    try {
        await api(`/articles/${articleId}`, {
            method: 'PATCH',
            body: JSON.stringify({ severity }),
        });
        
        closeModal('articleModal');
        
        // Refresh all feed panels
        state.currentDashboard.panels
            .filter(p => p.module === 'feed')
            .forEach(p => refreshFeedPanel(p.id));
            
    } catch (error) {
        console.error('Failed to update severity:', error);
    }
}

// ============ SETTINGS SIDEBAR ============

function toggleSettings() {
    const settingsPage = document.getElementById('settings-page');
    
    if (settingsPage) {
        const isVisible = settingsPage.style.display !== 'none';
        settingsPage.style.display = isVisible ? 'none' : 'block';
        
        // Load fresh settings when opening
        if (!isVisible && SettingsModule) {
            SettingsModule.loadSettings();
        }
    }
    
    // Also handle legacy settingsSidebar for backward compatibility
    const sidebar = document.getElementById('settingsSidebar');
    const container = document.getElementById('dashboardContainer');
    
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (container) {
        container.classList.toggle('sidebar-open');
    }
    
    // Invalidate map size if present
    if (state.map) {
        setTimeout(() => state.map.invalidateSize(), 300);
    }
}

function renderSourcesList() {
    const list = document.getElementById('sourcesList');
    if (!list) {
        return;
    }
    
    if (state.sources.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No sources configured</p>';
        return;
    }
    
    list.innerHTML = state.sources.map(source => `
        <div class="source-item">
            <div class="source-info">
                <span class="source-type-badge ${source.source_type}">${source.source_type}</span>
                <span>${source.name}</span>
            </div>
            <button class="btn btn-icon" onclick="deleteSource(${source.id})" title="Delete">🗑️</button>
        </div>
    `).join('');
}

// ============ SOURCE MODAL ============

function openSourceModal() {
    updateSourceForm();
    openModal('sourceModal');
}

function updateSourceForm() {
    const sourceType = document.getElementById('sourceType').value;
    const urlGroup = document.getElementById('sourceUrlGroup');
    const configGroup = document.getElementById('sourceConfigGroup');
    
    // Show/hide URL field based on source type
    if (sourceType === 'rss') {
        urlGroup.style.display = 'block';
        configGroup.innerHTML = '';
    } else if (sourceType === 'gdelt') {
        urlGroup.style.display = 'none';
        configGroup.innerHTML = `
            <label>Search Query</label>
            <input type="text" id="gdeltQuery" placeholder="security OR conflict OR crisis">
        `;
    } else if (sourceType === 'reddit') {
        urlGroup.style.display = 'none';
        configGroup.innerHTML = `
            <label>Subreddit</label>
            <input type="text" id="redditSubreddit" placeholder="worldnews">
        `;
    } else if (sourceType === 'telegram') {
        urlGroup.style.display = 'none';
        configGroup.innerHTML = `
            <label>Channel Name</label>
            <input type="text" id="telegramChannel" placeholder="channel_name">
        `;
    } else {
        urlGroup.style.display = 'none';
        configGroup.innerHTML = '';
    }
}

async function saveSource() {
    const sourceType = document.getElementById('sourceType').value;
    const name = document.getElementById('sourceName').value;
    const category = document.getElementById('sourceCategory').value;
    
    let sourceData = {
        name,
        source_type: sourceType,
        category,
        config: {},
    };
    
    if (sourceType === 'rss') {
        sourceData.url = document.getElementById('sourceUrl').value;
    } else if (sourceType === 'gdelt') {
        sourceData.config.query = document.getElementById('gdeltQuery')?.value || 'security';
    } else if (sourceType === 'reddit') {
        sourceData.config.subreddit = document.getElementById('redditSubreddit')?.value || 'worldnews';
    } else if (sourceType === 'telegram') {
        sourceData.config.channel = document.getElementById('telegramChannel')?.value;
    }
    
    try {
        await api('/sources', {
            method: 'POST',
            body: JSON.stringify(sourceData),
        });
        
        await loadSources();
        closeModal('sourceModal');
        
        // Clear form
        document.getElementById('sourceName').value = '';
        document.getElementById('sourceUrl').value = '';
        
    } catch (error) {
        console.error('Failed to add source:', error);
        alert('Failed to add source');
    }
}

async function deleteSource(sourceId) {
    if (!confirm('Delete this source?')) return;
    
    try {
        await api(`/sources/${sourceId}`, { method: 'DELETE' });
        await loadSources();
    } catch (error) {
        console.error('Failed to delete source:', error);
    }
}

// ============ DASHBOARD MODAL ============

function openDashboardModal() {
    state.selectedLayout = '2x2';
    document.querySelector('.layout-option[data-layout="2x2"]').classList.add('active');
    updatePanelConfigurator();
    openModal('dashboardModal');
}

function selectLayout(layout) {
    state.selectedLayout = layout;
    
    document.querySelectorAll('.layout-option').forEach(el => {
        el.classList.toggle('active', el.dataset.layout === layout);
    });
    
    updatePanelConfigurator();
}

function updatePanelConfigurator() {
    const container = document.getElementById('panelConfigurator');
    const layout = state.selectedLayout;
    
    // Determine panel count from layout
    const panelCounts = { '1x1': 1, '2x1': 2, '1x2': 2, '2x2': 4, '3x1': 3, '3x2': 6, '2x3': 6, '4x2': 8, '2x4': 8 };
    const count = panelCounts[layout] || 4;
    
    container.innerHTML = Array.from({ length: count }, (_, i) => {
        return `
        <div class="panel-config-item">
            <h4>Panel ${i + 1}</h4>
            <div class="form-group">
                <label>Module</label>
                <select id="panel-${i}-module" onchange="window.updatePanelModuleFields(${i})">
                    ${Object.entries(MODULES).map(([key, mod]) => `
                        <option value="${key}" ${key === 'feed' ? 'selected' : ''}>
                            ${mod.icon} ${mod.name} - ${mod.description}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Title (optional)</label>
                <input type="text" id="panel-${i}-title" placeholder="${MODULES.feed.name}">
            </div>
            <div class="form-group" id="panel-${i}-filters">
                <label>Category Filter</label>
                <select id="panel-${i}-category">
                    ${CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" id="panel-${i}-maptype-group" style="display:none;">
                <label>Map Type</label>
                <select id="panel-${i}-maptype">
                    <option value="heatmap">Heatmap</option>
                    <option value="aircraft">Aircraft</option>
                    <option value="marine">Marine</option>
                </select>
            </div>
        </div>
        `;
    }).join('');
    // Show map type selector for map panels
    for (let i = 0; i < count; i++) {
        setTimeout(() => window.updatePanelModuleFields(i), 0);
    }
// Show/hide map type selector based on module
window.updatePanelModuleFields = function(idx) {
    const moduleSel = document.getElementById(`panel-${idx}-module`);
    const mapTypeGroup = document.getElementById(`panel-${idx}-maptype-group`);
    if (!moduleSel || !mapTypeGroup) return;
    if (moduleSel.value === 'map') {
        mapTypeGroup.style.display = '';
    } else {
        mapTypeGroup.style.display = 'none';
    }
};
}

async function saveDashboard() {
    const name = document.getElementById('dashboardName').value || 'My Dashboard';
    const layout = state.selectedLayout;
    
    const panelCounts = { '1x1': 1, '2x1': 2, '1x2': 2, '2x2': 4, '3x1': 3, '3x2': 6, '2x3': 6, '4x2': 8, '2x4': 8 };
    const count = panelCounts[layout] || 4;
    
    const panels = Array.from({ length: count }, (_, i) => {
        const module = document.getElementById(`panel-${i}-module`).value;
        const title = document.getElementById(`panel-${i}-title`).value;
        const category = document.getElementById(`panel-${i}-category`)?.value;
        let mapType = undefined;
        if (module === 'map') {
            mapType = document.getElementById(`panel-${i}-maptype`)?.value || 'heatmap';
        }
        return {
            id: `panel-${i + 1}`,
            module,
            title: title || MODULES[module].name,
            filters: category ? { category } : {},
            mapType: mapType,
        };
    });
    
    try {
        const dashboard = await api('/dashboards', {
            method: 'POST',
            body: JSON.stringify({ name, layout, panels }),
        });
        
        state.dashboards.push(dashboard);
        state.currentDashboard = dashboard;
        
        updateDashboardSelector();
        closeModal('dashboardModal');
        renderDashboard();
        
    } catch (error) {
        console.error('Failed to save dashboard:', error);
        alert('Failed to save dashboard');
    }
}

function updateDashboardSelector() {
    const selector = document.getElementById('dashboardSelector');
    
    selector.innerHTML = state.dashboards.map(d => `
        <option value="${d.id}" ${d.id === state.currentDashboard?.id ? 'selected' : ''}>
            ${d.name}
        </option>
    `).join('');
    
    if (state.dashboards.length === 0) {
        selector.innerHTML = '<option value="default">Default Dashboard</option>';
    }
}

async function deleteDashboard() {
    const dashboardId = state.currentDashboard?.id;
    if (!dashboardId) {
        showNotification('Cannot delete the default dashboard', 'warning');
        return;
    }
    
    const dashboardName = state.currentDashboard?.name || 'this dashboard';
    if (!confirm(`Delete "${dashboardName}"? This cannot be undone.`)) {
        return;
    }
    
    try {
        await api(`/dashboards/${dashboardId}`, { method: 'DELETE' });
        
        // Remove from state
        state.dashboards = state.dashboards.filter(d => d.id !== dashboardId);
        
        // Switch to first available or default
        if (state.dashboards.length > 0) {
            state.currentDashboard = state.dashboards[0];
        } else {
            state.currentDashboard = createDefaultDashboard();
        }
        
        updateDashboardSelector();
        renderDashboard();
        showNotification('Dashboard deleted', 'success');
        
    } catch (error) {
        console.error('Failed to delete dashboard:', error);
        showNotification('Failed to delete dashboard', 'error');
    }
}

async function loadDashboard(dashboardId) {
    const dashboard = state.dashboards.find(d => d.id == dashboardId);
    if (dashboard) {
        state.currentDashboard = dashboard;
        renderDashboard();
    }
}

// ============ UTILITY FUNCTIONS ============

function openModal(modalId) {
    document.getElementById(modalId).classList.add('open');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('open');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

function playAlertSound() {
    // Simple beep using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        setTimeout(() => oscillator.stop(), 150);
    } catch (e) {
        // Audio not available
    }
}

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function triggerFetch() {
    try {
        await api('/fetch-now', { method: 'POST' });
        console.log('Fetch triggered');
    } catch (error) {
        console.error('Fetch failed:', error);
    }
}

// ============ DRAG & DROP PANEL REORDERING ============

let draggedPanelId = null;

function handleDragStart(event, panelId) {
    draggedPanelId = panelId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', panelId);
    
    // Add visual feedback
    setTimeout(() => {
        document.getElementById(panelId)?.classList.add('dragging');
    }, 0);
}

function handleDragEnd(event) {
    // Remove all drag visual states
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('dragging', 'drag-over');
    });
    draggedPanelId = null;
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const panel = event.target.closest('.panel');
    if (panel && panel.id !== draggedPanelId) {
        // Remove drag-over from all panels
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('drag-over'));
        panel.classList.add('drag-over');
    }
}

function handleDrop(event, targetPanelId) {
    event.preventDefault();
    
    if (!draggedPanelId || draggedPanelId === targetPanelId) return;
    
    const container = document.querySelector('.dashboard-container');
    const panels = Array.from(container.querySelectorAll('.panel'));
    const draggedPanel = document.getElementById(draggedPanelId);
    const targetPanel = document.getElementById(targetPanelId);
    
    if (!draggedPanel || !targetPanel) return;
    
    // Get positions
    const draggedIdx = panels.indexOf(draggedPanel);
    const targetIdx = panels.indexOf(targetPanel);
    
    // Swap panels
    if (draggedIdx < targetIdx) {
        targetPanel.after(draggedPanel);
    } else {
        targetPanel.before(draggedPanel);
    }
    
    // Update state
    updatePanelOrder();
    
    // Remove visual states
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('dragging', 'drag-over'));
}

function updatePanelOrder() {
    // Update panel order in current dashboard state
    const container = document.querySelector('.dashboard-container');
    const panels = Array.from(container.querySelectorAll('.panel'));
    
    if (state.currentDashboard) {
        state.currentDashboard.panels = panels.map((panel, i) => {
            const existing = state.currentDashboard.panels.find(p => p.id === panel.id);
            return existing || { id: panel.id, module: panel.dataset.module };
        });
        console.log('Panel order updated:', state.currentDashboard.panels.map(p => p.id));
    }
}

// ============ PANEL EXPAND/FOCUS ============

let expandedPanelId = null;

function togglePanelExpand(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    
    // If already expanded, collapse
    if (expandedPanelId === panelId) {
        collapsePanel(panel);
        return;
    }
    
    // If another panel is expanded, collapse it first
    if (expandedPanelId) {
        const expandedPanel = document.getElementById(expandedPanelId);
        if (expandedPanel) collapsePanel(expandedPanel);
    }
    
    // Expand this panel
    expandPanel(panel);
}

function expandPanel(panel) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'expanded-overlay';
    overlay.id = 'panel-overlay';
    overlay.onclick = () => togglePanelExpand(panel.id);
    document.body.appendChild(overlay);
    
    // Expand panel
    panel.classList.add('expanded');
    expandedPanelId = panel.id;
    
    // Update expand button
    const expandBtn = panel.querySelector('.expand-btn');
    if (expandBtn) expandBtn.textContent = '⛶'; // Will show close icon with CSS
    
    // Re-render map if it's a map panel
    if (panel.dataset.module === 'map' && state.map) {
        setTimeout(() => state.map.invalidateSize(), 100);
    }
}

function collapsePanel(panel) {
    // Remove overlay
    const overlay = document.getElementById('panel-overlay');
    if (overlay) overlay.remove();
    
    // Collapse panel
    panel.classList.remove('expanded');
    expandedPanelId = null;
    
    // Re-render map if it's a map panel
    if (panel.dataset.module === 'map' && state.map) {
        setTimeout(() => state.map.invalidateSize(), 100);
    }
}

// Handle Escape key to close expanded panel
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expandedPanelId) {
        togglePanelExpand(expandedPanelId);
    }
});

// Make functions available globally
window.toggleSettings = toggleSettings;
window.triggerFetch = triggerFetch;
window.openDashboardModal = openDashboardModal;
window.openSourceModal = openSourceModal;
window.closeModal = closeModal;
window.openArticle = openArticle;
window.setSeverity = setSeverity;
window.filterPanel = filterPanel;
window.selectLayout = selectLayout;
window.saveDashboard = saveDashboard;
window.saveSource = saveSource;
window.deleteSource = deleteSource;
window.loadDashboard = loadDashboard;
window.deleteDashboard = deleteDashboard;
window.updateSourceForm = updateSourceForm;
window.configurePanelModal = (panelId) => {
    const panel = (state.currentDashboard && state.currentDashboard.panels)
        ? state.currentDashboard.panels.find(p => p.id === panelId)
        : null;
    if (!panel) return;
    let modal = document.getElementById('panelSettingsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'panelSettingsModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = 'var(--bg-panel)';
        modal.style.color = 'var(--text-primary)';
        modal.style.padding = '32px 40px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 4px 32px rgba(0,0,0,0.7)';
        modal.style.zIndex = 10000;
        modal.style.minWidth = '340px';
        modal.innerHTML = '';
        document.body.appendChild(modal);
    }
    // Build module options
    const moduleOptions = Object.entries(MODULES).map(([key, mod]) =>
        `<option value="${key}" ${panel.module === key ? 'selected' : ''}>${mod.icon} ${mod.name}</option>`
    ).join('');
    // Build filter options (category for feed, etc.)
    let filterFields = '';
    if (MODULES[panel.module]?.hasFilters) {
        filterFields = `<div class="form-group">
            <label>Category Filter</label>
            <input type="text" id="panelEditCategory" value="${panel.filters?.category || ''}" placeholder="(optional)">
        </div>`;
    }
    modal.innerHTML = `
        <div style="font-size:1.2rem;font-weight:600;margin-bottom:12px;">Edit Panel</div>
        <div class="form-group">
            <label>Module</label>
            <select id="panelEditModule">${moduleOptions}</select>
        </div>
        <div class="form-group">
            <label>Title</label>
            <input type="text" id="panelEditTitle" value="${panel.title || ''}" placeholder="(optional)">
        </div>
        ${filterFields}
        <div style="margin-top:18px;display:flex;gap:12px;justify-content:flex-end;">
            <button onclick="document.getElementById('panelSettingsModal').remove()" style="padding:8px 18px;font-size:1rem;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Cancel</button>
            <button onclick="window.savePanelEdit('${panelId}')" style="padding:8px 18px;font-size:1rem;background:var(--accent-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;">Save</button>
        </div>
    `;
    modal.style.display = 'block';
    // Update filter fields if module changes
    modal.querySelector('#panelEditModule').addEventListener('change', (e) => {
        const selected = e.target.value;
        let filterFields = '';
        if (MODULES[selected]?.hasFilters) {
            filterFields = `<div class=\"form-group\">
                <label>Category Filter</label>
                <input type=\"text\" id=\"panelEditCategory\" value=\"${panel.filters?.category || ''}\" placeholder=\"(optional)\">
            </div>`;
        }
        // Replace or add filter fields
        const old = modal.querySelector('#panelEditCategory')?.parentElement;
        if (old) old.outerHTML = filterFields; else if (filterFields) {
            modal.querySelector('#panelEditTitle').insertAdjacentHTML('afterend', filterFields);
        }
    });
};

window.savePanelEdit = (panelId) => {
    const panel = (state.currentDashboard && state.currentDashboard.panels)
        ? state.currentDashboard.panels.find(p => p.id === panelId)
        : null;
    if (!panel) return;
    const module = document.getElementById('panelEditModule').value;
    const title = document.getElementById('panelEditTitle').value;
    let filters = {};
    if (MODULES[module]?.hasFilters) {
        const category = document.getElementById('panelEditCategory')?.value;
        if (category) filters.category = category;
    }
    panel.module = module;
    panel.title = title;
    panel.filters = filters;
    document.getElementById('panelSettingsModal').remove();
    renderDashboard();
};

// Drag/Drop and Expand
window.handleDragStart = handleDragStart;
window.handleDragEnd = handleDragEnd;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.togglePanelExpand = togglePanelExpand;

// Aircraft controls
window.changeAircraftRegion = changeAircraftRegion;
window.refreshAircraftData = refreshAircraftData;
window.setAircraftFilter = setAircraftFilter;

// Robust map resize on sidebar open and window resize
window.addEventListener('resize', () => {
    if (state.map) setTimeout(() => state.map.invalidateSize(), 200);
});

// Aircraft filter global setting
let aircraftFilterSetting = 'all';
function setAircraftFilterSetting(val) {
    aircraftFilterSetting = val;
    setAircraftFilter(val);
    // Update radio buttons if changed elsewhere
    document.querySelectorAll('input[name="aircraftFilterSetting"]').forEach(r => {
        r.checked = (r.value === val);
    });
}

// On load, sync filter

window.addEventListener('DOMContentLoaded', () => {
    setAircraftFilterSetting(aircraftFilterSetting);
});

// Expose key functions globally
window.renderPanel = renderPanel;
window.renderSourcesList = renderSourcesList;
window.updateDashboardSelector = updateDashboardSelector;

// ============ PAGE NAVIGATION SYSTEM ============

// Page Templates
const PAGE_TEMPLATES = {
    'command-center': {
        name: 'Intelligence Command Center',
        layout: '2x2',
        panels: [
            { id: 'panel-1', module: 'feed', title: 'Intelligence Feed', filters: {}, feedView: 'tiled' },
            { id: 'panel-2', module: 'map', title: 'Global Heat Map', filters: {} },
            { id: 'panel-3', module: 'clock', title: 'World Clocks', filters: {} },
            { id: 'panel-4', module: 'stats', title: 'Statistics', filters: {} },
        ],
    },
    'aviation': {
        name: 'Aviation Intelligence',
        layout: 'flexible',
        panels: [
            { id: 'panel-map', module: 'web', title: 'ADSBexchange Live', url: 'https://globe.adsbexchange.com/', width: '100%', height: '300px' },
            { id: 'panel-1', module: 'feed', title: '✈️ Aviation Intel', filters: { category: 'aviation' }, feedView: 'irc', width: '50%' },
            { id: 'panel-2', module: 'custom', title: '🎖️ Interesting Flights', apiEndpoint: '/api/aircraft/interesting', width: '50%' },
            { id: 'panel-3', module: 'feed', title: '📡 Military Ops & Rare Aircraft', filters: { category: 'aviation', severity: 'critical,high' }, feedView: 'tiled', width: '100%' },
            { id: 'panel-4', module: 'stats', title: 'Aviation Stats', filters: { category: 'aviation' }, width: '100%' },
        ],
    },
    'marine': {
        name: 'Maritime Intelligence',
        layout: 'flexible',
        panels: [
            { id: 'panel-map', module: 'web', title: 'MarineTraffic Live', url: 'https://www.marinetraffic.com/en/ais/home/', width: '100%', height: '300px' },
            { id: 'panel-1', module: 'feed', title: '🌊 Maritime Intel', filters: { category: 'marine' }, feedView: 'irc', width: '50%' },
            { id: 'panel-2', module: 'custom', title: '🚢 Interesting Ships', apiEndpoint: '/api/marine/interesting', width: '50%' },
            { id: 'panel-3', module: 'feed', title: '⚓ Maritime News & Alerts', filters: { category: 'marine', severity: 'critical,high' }, feedView: 'tiled', width: '100%' },
        ],
    },
    'hot-videos': {
        name: 'Hot Videos Intelligence',
        layout: '2x1',
        panels: [
            { id: 'panel-1', module: 'videos', title: '🎥 Hot Video Sources', filters: {} },
            { id: 'panel-2', module: 'web', title: '🌐 Web Intel', filters: {} },
        ],
    },
    'rss-feeder': {
        name: 'RSS Intelligence Feeder',
        layout: '2x2',
        panels: [
            { id: 'panel-1', module: 'feed', title: 'Tiled Feed', filters: {}, feedView: 'tiled' },
            { id: 'panel-2', module: 'feed', title: 'IRC Feed', filters: {}, feedView: 'irc' },
            { id: 'panel-3', module: 'map', title: 'Geographic Heat', filters: {} },
            { id: 'panel-4', module: 'stats', title: 'Feed Statistics', filters: {} },
        ],
    },
};

// Switch to a specific page view
window.switchPage = async function(pageName) {
    console.log(`🔄 Switching to page: ${pageName}`);
    
    // Update active button
    document.querySelectorAll('.page-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageName);
    });
    
    // Save current page to localStorage
    localStorage.setItem('currentPage', pageName);
    
    if (pageName === 'custom') {
        // Load user's custom dashboards
        if (state.dashboards.length === 0) {
            state.currentDashboard = createDefaultDashboard();
        } else {
            state.currentDashboard = state.dashboards.find(d => d.is_default) || state.dashboards[0];
        }
    } else {
        // Load page template
        const template = PAGE_TEMPLATES[pageName];
        if (template) {
            state.currentDashboard = {
                id: `page-${pageName}`,
                name: template.name,
                layout: template.layout,
                panels: template.panels,
            };
        }
    }
    
    renderDashboard();
};

// ============ WEB MODULE CONFIGURATION ============

let currentWebModulePanelId = null;

// Open web module config from panel
window.openWebModuleConfig = function(panelId) {
    currentWebModulePanelId = panelId;
    const currentUrl = localStorage.getItem(`webModuleUrl_${panelId}`) || 'https://globe.adsbexchange.com/';
    document.getElementById('webModuleUrlInput').value = currentUrl;
    openModal('webModuleModal');
};

// Select a preset URL
window.selectWebPreset = function(url) {
    document.getElementById('webModuleUrlInput').value = url;
};

// Save web module URL
window.saveWebModuleUrl = function() {
    const url = document.getElementById('webModuleUrlInput').value.trim();
    
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    // Basic URL validation
    try {
        new URL(url);
    } catch (e) {
        alert('Invalid URL format. Please include https://');
        return;
    }
    
    if (currentWebModulePanelId) {
        // Save URL for this specific panel
        localStorage.setItem(`webModuleUrl_${currentWebModulePanelId}`, url);
        
        // Reload the web panel
        const iframe = document.querySelector(`#${currentWebModulePanelId}-content iframe`);
        if (iframe) {
            iframe.src = url;
        }
    }
    
    closeModal('webModuleModal');
    console.log(`✅ Web module URL saved: ${url}`);
};
