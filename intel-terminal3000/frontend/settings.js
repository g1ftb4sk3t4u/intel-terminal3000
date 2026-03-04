/**
 * Settings Module for Intel Terminal 3000
 * Handles loading, updating, and persisting user settings
 */

const SettingsModule = (() => {
    let currentSettings = null;
    let sources = [];
    let categories = ['cyber', 'geo', 'economic', 'tech', 'health', 'science'];

    // Initialize settings module
    async function init() {
        console.log('Initializing Settings Module...');
        
        // Load initial settings
        await loadSettings();
        
        // Attach event listeners
        attachEventListeners();
        
        // Load sources for the sources section
        await loadSourcesList();
        
        console.log('Settings Module initialized');
    }

    // Load settings from API
    async function loadSettings() {
        try {
            const response = await fetch(`${window.API_BASE}/api/settings`);
            if (!response.ok) throw new Error(`Failed to load settings: ${response.status}`);
            
            currentSettings = await response.json();
            console.log('Settings loaded:', currentSettings);
            
            // Populate UI with loaded settings
            populateSettingsUI();
        } catch (error) {
            console.error('Error loading settings:', error);
            showSettingsStatus('Failed to load settings', 'error');
        }
    }

    // Populate UI with current settings values
    function populateSettingsUI() {
        if (!currentSettings) return;

        // Alert Settings
        const alertSoundToggle = document.getElementById('alert-sound-toggle');
        if (alertSoundToggle) {
            alertSoundToggle.checked = currentSettings.alert_sound_enabled || false;
        }

        const volumeSlider = document.getElementById('alert-volume');
        if (volumeSlider) {
            volumeSlider.value = currentSettings.alert_volume || 80;
            updateVolumeDisplay(currentSettings.alert_volume || 80);
        }

        const trendingToggle = document.getElementById('trending-alerts-toggle');
        if (trendingToggle) {
            trendingToggle.checked = currentSettings.show_trending_alerts !== false;
        }

        // Display Settings
        const heatmapToggle = document.getElementById('heatmap-toggle');
        if (heatmapToggle) {
            heatmapToggle.checked = currentSettings.show_map_heatmap !== false;
        }

        const aiSummaryToggle = document.getElementById('ai-summary-toggle');
        if (aiSummaryToggle) {
            aiSummaryToggle.checked = currentSettings.show_ai_summaries !== false;
        }

        const sortOrder = document.getElementById('sort-order');
        if (sortOrder) {
            sortOrder.value = currentSettings.sort_order || 'newest';
        }

        const cardsPerRow = document.getElementById('cards-per-row');
        if (cardsPerRow) {
            cardsPerRow.value = currentSettings.cards_per_row || 3;
        }

        // General Settings
        const timezone = document.getElementById('timezone-select');
        if (timezone) {
            timezone.value = currentSettings.timezone || 'UTC';
        }

        // Populate sources
        populateSourcesUI();

        // Populate categories
        populateCategoriesUI();
    }

    // Load and populate sources list
    async function loadSourcesList() {
        try {
            const response = await fetch(`${window.API_BASE}/api/sources`);
            if (!response.ok) throw new Error(`Failed to load sources: ${response.status}`);
            
            sources = await response.json();
            console.log('Sources loaded:', sources);
            
            populateSourcesUI();
        } catch (error) {
            console.error('Error loading sources:', error);
        }
    }

    // Populate sources in UI
    function populateSourcesUI() {
        const sourcesList = document.getElementById('sources-list');
        if (!sourcesList) return;

        if (!sources || sources.length === 0) {
            sourcesList.innerHTML = '<p style="color: var(--text-secondary); padding: 16px; text-align: center;">No sources available</p>';
            return;
        }

        const enabledSources = currentSettings?.enabled_sources || {};

        // Group sources by category
        const sourcesByCategory = {};
        sources.forEach(source => {
            const cat = source.category || 'other';
            if (!sourcesByCategory[cat]) {
                sourcesByCategory[cat] = [];
            }
            sourcesByCategory[cat].push(source);
        });

        // Category display names with emojis
        const categoryNames = {
            'cyber': '🔓 Cybersecurity',
            'geopolitical': '🌍 Geopolitical',
            'economic': '💰 Economic',
            'tech': '💻 Technology',
            'health': '⚕️ Health',
            'science': '🔬 Science',
            'weather': '🌦️ Weather',
            'energy': '⚡ Energy',
            'space': '🛰️ Space',
            'aviation': '✈️ Aviation',
            'marine': '⚓ Maritime',
            'military': '🎖️ Military',
            'osint': '🔍 OSINT',
            'infrastructure': '🏗️ Infrastructure',
            'other': '📁 Other'
        };

        // Sort categories
        const sortedCategories = Object.keys(sourcesByCategory).sort();

        // Build HTML with collapsible categories
        let html = '';
        sortedCategories.forEach(cat => {
            const catSources = sourcesByCategory[cat];
            const catName = categoryNames[cat] || cat;
            const catId = `category-folder-${cat}`;
            
            html += `
                <div class="source-category">
                    <div class="source-category-header" data-category="${cat}">
                        <span class="category-toggle">▶</span>
                        <strong>${catName}</strong>
                        <span class="category-count">(${catSources.length})</span>
                    </div>
                    <div class="source-category-content" id="${catId}" style="display: none;">
            `;
            
            catSources.forEach(source => {
                const isEnabled = enabledSources[source.id] !== false;
                html += `
                    <div class="source-item">
                        <input 
                            type="checkbox" 
                            id="source-${source.id}" 
                            class="source-toggle" 
                            data-source-id="${source.id}"
                            ${isEnabled ? 'checked' : ''}
                        >
                        <label for="source-${source.id}">
                            <strong>${source.name}</strong>
                            ${source.url ? `<br><small style="color: var(--text-secondary);">${source.url}</small>` : ''}
                        </label>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });

        sourcesList.innerHTML = html;

        // Attach listeners to category headers for collapse/expand
        document.querySelectorAll('.source-category-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const cat = e.currentTarget.dataset.category;
                const content = document.getElementById(`category-folder-${cat}`);
                const toggle = e.currentTarget.querySelector('.category-toggle');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggle.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    toggle.textContent = '▶';
                }
            });
        });

        // Attach listeners to source toggles
        document.querySelectorAll('.source-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const sourceId = e.target.dataset.sourceId;
                await toggleSource(sourceId, e.target.checked);
            });
        });
    }

    // Populate categories in UI
    function populateCategoriesUI() {
        const categoriesList = document.getElementById('categories-list');
        if (!categoriesList) return;

        const categoryNames = {
            'cyber': '🔓 Cybersecurity',
            'geo': '🗺️ Geopolitical',
            'economic': '💰 Economic',
            'tech': '💻 Technology',
            'health': '⚕️ Health',
            'science': '🔬 Science'
        };

        const enabledCategories = currentSettings?.enabled_categories || {};

        categoriesList.innerHTML = categories.map(cat => {
            const isEnabled = enabledCategories[cat] !== false; // Default to enabled
            const displayName = categoryNames[cat] || cat;
            return `
                <div class="category-item">
                    <input 
                        type="checkbox" 
                        id="cat-${cat}" 
                        class="category-toggle" 
                        data-category="${cat}"
                        ${isEnabled ? 'checked' : ''}
                    >
                    <label for="cat-${cat}">${displayName}</label>
                </div>
            `;
        }).join('');

        // Attach listeners to category toggles
        document.querySelectorAll('.category-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const category = e.target.dataset.category;
                await toggleCategory(category, e.target.checked);
            });
        });
    }

    // Attach event listeners to all form controls
    function attachEventListeners() {
        // Alert Settings
        const alertSoundToggle = document.getElementById('alert-sound-toggle');
        if (alertSoundToggle) {
            alertSoundToggle.addEventListener('change', async (e) => {
                await updateSetting('alert_sound_enabled', e.target.checked);
            });
        }

        const volumeSlider = document.getElementById('alert-volume');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                updateVolumeDisplay(e.target.value);
            });
            volumeSlider.addEventListener('change', async (e) => {
                await updateSetting('alert_volume', parseInt(e.target.value));
            });
        }

        const trendingToggle = document.getElementById('trending-alerts-toggle');
        if (trendingToggle) {
            trendingToggle.addEventListener('change', async (e) => {
                await updateSetting('show_trending_alerts', e.target.checked);
            });
        }

        // Display Settings
        const heatmapToggle = document.getElementById('heatmap-toggle');
        if (heatmapToggle) {
            heatmapToggle.addEventListener('change', async (e) => {
                await updateSetting('show_map_heatmap', e.target.checked);
            });
        }

        const aiSummaryToggle = document.getElementById('ai-summary-toggle');
        if (aiSummaryToggle) {
            aiSummaryToggle.addEventListener('change', async (e) => {
                await updateSetting('show_ai_summaries', e.target.checked);
            });
        }

        const sortOrder = document.getElementById('sort-order');
        if (sortOrder) {
            sortOrder.addEventListener('change', async (e) => {
                await updateSetting('sort_order', e.target.value);
            });
        }

        const cardsPerRow = document.getElementById('cards-per-row');
        if (cardsPerRow) {
            cardsPerRow.addEventListener('change', async (e) => {
                await updateSetting('cards_per_row', parseInt(e.target.value));
            });
        }

        const hideReadToggle = document.getElementById('hide-read-toggle');
        if (hideReadToggle) {
            hideReadToggle.addEventListener('change', async (e) => {
                await updateSetting('hide_read_articles', e.target.checked);
            });
        }

        // General Settings
        const timezone = document.getElementById('timezone-select');
        if (timezone) {
            timezone.addEventListener('change', async (e) => {
                await updateSetting('timezone', e.target.value);
            });
        }

        // Settings Navigation
        attachSettingsNavigation();
    }

    // Attach settings sidebar navigation
    function attachSettingsNavigation() {
        const navButtons = document.querySelectorAll('.settings-nav-btn');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const section = button.dataset.section;
                switchSettingsSection(section);
            });
        });
    }

    // Switch settings section
    function switchSettingsSection(section) {
        // Hide all sections
        document.querySelectorAll('.settings-section').forEach(sec => {
            sec.classList.remove('active');
        });

        // Remove active class from all nav buttons
        document.querySelectorAll('.settings-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected section
        const selectedSection = document.getElementById(`${section}-section`);
        if (selectedSection) {
            selectedSection.classList.add('active');
        }

        // Mark nav button as active
        event.target.classList.add('active');
    }

    // Update volume display
    function updateVolumeDisplay(value) {
        const display = document.getElementById('volume-display');
        if (display) {
            display.textContent = value + '%';
        }
    }

    // Toggle source enabled/disabled
    async function toggleSource(sourceId, enabled) {
        try {
            const response = await fetch(`${window.API_BASE}/api/settings/sources/${sourceId}?enabled=${enabled}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error(`Failed to toggle source: ${response.status}`);
            
            const result = await response.json();
            currentSettings.enabled_sources[sourceId] = enabled;
            console.log('Source toggled successfully:', sourceId, enabled);
            showSettingsStatus('Source settings updated', 'success');
        } catch (error) {
            console.error('Error toggling source:', error);
            showSettingsStatus('Failed to update source settings', 'error');
        }
    }

    // Toggle category enabled/disabled
    async function toggleCategory(category, enabled) {
        try {
            const response = await fetch(`/api/settings/categories/${category}?enabled=${enabled}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error(`Failed to toggle category: ${response.status}`);
            
            const result = await response.json();
            currentSettings.enabled_categories[category] = enabled;
            console.log('Category toggled successfully:', category, enabled);
            showSettingsStatus('Category settings updated', 'success');
        } catch (error) {
            console.error('Error toggling category:', error);
            showSettingsStatus('Failed to update category settings', 'error');
        }
    }

    // Update a single setting
    async function updateSetting(fieldName, value) {
        try {
            const response = await fetch(`${window.API_BASE}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [fieldName]: value })
            });

            if (!response.ok) throw new Error(`Failed to update setting: ${response.status}`);
            
            const result = await response.json();
            currentSettings = result;
            console.log('Setting updated successfully:', fieldName, value);
            showSettingsStatus('Settings updated', 'success');
        } catch (error) {
            console.error('Error updating setting:', error);
            showSettingsStatus('Failed to update settings', 'error');
        }
    }

    // Test alert sound
    function testAlertSound() {
        const volume = currentSettings?.alert_volume || 80;
        playAlertSound(volume);
        showSettingsStatus('Alert sound test played', 'info');
    }

    // Play alert sound
    function playAlertSound(volume = 80) {
        // Create audio context if not exists
        if (!window.audioContext) {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const ctx = window.audioContext;
        const volumePercent = volume / 100;

        // Create oscillator for alert tone (high beep)
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Set up beep sound characteristics
        oscillator.frequency.value = 800; // Hz
        oscillator.type = 'sine';

        // Set volume
        gainNode.gain.setValueAtTime(0.3 * volumePercent, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        // Play beep
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
    }

    // Show status message
    function showSettingsStatus(message, type = 'info') {
        // Create or get status element
        let statusEl = document.getElementById('settings-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'settings-status';
            statusEl.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 4px;
                font-size: 0.9rem;
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
            `;
            document.body.appendChild(statusEl);
        }

        // Set type-specific styling
        const bgColor = type === 'success' ? 'var(--accent)' : type === 'error' ? '#ef4444' : '#3b82f6';
        statusEl.style.backgroundColor = bgColor;
        statusEl.style.color = 'white';
        statusEl.textContent = message;
        statusEl.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }

    // Select all categories
    function selectAllCategories() {
        document.querySelectorAll('.category-toggle').forEach(toggle => {
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    // Deselect all categories
    function deselectAllCategories() {
        document.querySelectorAll('.category-toggle').forEach(toggle => {
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    // Get current settings
    function getSettings() {
        return currentSettings;
    }

    // ============ ADMIN FUNCTIONS ============

    let feedRowCounter = 1;

    // Load categories into dropdown
    async function loadCategoryDropdown() {
        const select = document.getElementById('feed-category-select');
        if (!select) return;

        const categoryNames = {
            'cyber': '🔓 Cybersecurity',
            'geopolitical': '🌍 Geopolitical',
            'economic': '💰 Economic',
            'tech': '💻 Technology',
            'health': '⚕️ Health',
            'science': '🔬 Science',
            'weather': '🌦️ Weather',
            'energy': '⚡ Energy',
            'space': '🛰️ Space',
            'aviation': '✈️ Aviation',
            'marine': '⚓ Maritime',
            'military': '🎖️ Military',
            'osint': '🔍 OSINT',
            'infrastructure': '🏗️ Infrastructure'
        };

        select.innerHTML = Object.entries(categoryNames)
            .map(([key, name]) => `<option value="${key}">${name}</option>`)
            .join('');
    }

    // Add a new feed input row
    function addFeedRow() {
        const container = document.getElementById('feeds-input-container');
        const newRow = document.createElement('div');
        newRow.className = 'feed-input-row';
        newRow.dataset.feedIndex = feedRowCounter;
        newRow.style.cssText = 'display: flex; gap: 12px; margin-top: 12px; align-items: center;';
        
        newRow.innerHTML = `
            <input type="text" class="input-field feed-name-input" placeholder="Feed Name" style="flex: 1;">
            <input type="text" class="input-field feed-url-input" placeholder="RSS URL" style="flex: 2;">
            <button class="btn btn-danger remove-feed-btn" onclick="removeFeedRow(${feedRowCounter})">✕</button>
        `;
        
        container.appendChild(newRow);
        feedRowCounter++;
    }

    // Remove a feed input row
    function removeFeedRow(index) {
        const row = document.querySelector(`.feed-input-row[data-feed-index="${index}"]`);
        if (row) row.remove();
    }

    // Clear feed form
    function clearFeedForm() {
        const container = document.getElementById('feeds-input-container');
        container.innerHTML = `
            <div class="feed-input-row" data-feed-index="0" style="display: flex; gap: 12px; margin-top: 12px; align-items: center;">
                <input type="text" class="input-field feed-name-input" placeholder="Feed Name (e.g., Twitter - OSINTdefender)" style="flex: 1;">
                <input type="text" class="input-field feed-url-input" placeholder="RSS URL (e.g., https://rsshub.app/twitter/user/OSINTdefender)" style="flex: 2;">
                <button class="btn btn-danger remove-feed-btn" onclick="removeFeedRow(0)" style="display: none;">✕</button>
            </div>
        `;
        feedRowCounter = 1;
        document.getElementById('feed-category-select').selectedIndex = 0;
        
        const status = document.getElementById('feed-add-status');
        if (status) status.style.display = 'none';
    }

    // Bulk add feeds
    async function bulkAddFeeds() {
        const category = document.getElementById('feed-category-select').value;
        const rows = document.querySelectorAll('.feed-input-row');
        const feeds = [];

        // Collect all feed data
        rows.forEach(row => {
            const name = row.querySelector('.feed-name-input').value.trim();
            const url = row.querySelector('.feed-url-input').value.trim();
            
            if (name && url) {
                feeds.push({ name, url, category });
            }
        });

        if (feeds.length === 0) {
            showFeedStatus('Please enter at least one feed', 'error');
            return;
        }

        // Show progress
        showFeedStatus(`Adding ${feeds.length} feed(s)...`, 'info');

        let successCount = 0;
        let errorCount = 0;

        // Add feeds one by one
        for (const feed of feeds) {
            try {
                const response = await fetch(`${window.API_BASE}/api/sources`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: feed.name,
                        source_type: 'rss',
                        url: feed.url,
                        category: feed.category,
                        enabled: true
                    })
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to add ${feed.name}:`, await response.text());
                }
            } catch (error) {
                errorCount++;
                console.error(`Error adding ${feed.name}:`, error);
            }
        }

        // Show result
        if (successCount > 0) {
            showFeedStatus(`✓ Successfully added ${successCount} feed(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}`, successCount > errorCount ? 'success' : 'error');
            
            // Reload sources list
            await loadSourcesList();
            
            // Clear form after success
            if (errorCount === 0) {
                setTimeout(() => clearFeedForm(), 2000);
            }
        } else {
            showFeedStatus(`✗ Failed to add feeds`, 'error');
        }
    }

    // Show feed add status
    function showFeedStatus(message, type) {
        const statusEl = document.getElementById('feed-add-status');
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.style.display = 'block';
        
        const bgColor = type === 'success' ? 'var(--accent)' : type === 'error' ? '#ef4444' : '#3b82f6';
        statusEl.style.backgroundColor = bgColor;
        statusEl.style.color = 'white';
    }

    // Create new category
    async function createCategory() {
        const name = document.getElementById('new-category-name').value.trim();
        const display = document.getElementById('new-category-display').value.trim();
        const emoji = document.getElementById('new-category-emoji').value.trim();

        if (!name) {
            showCategoryStatus('Please enter a category name', 'error');
            return;
        }

        // Validate category name (lowercase, no spaces)
        if (!/^[a-z0-9-_]+$/.test(name)) {
            showCategoryStatus('Category name must be lowercase with no spaces', 'error');
            return;
        }

        try {
            const response = await fetch(`${window.API_BASE}/api/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    display_name: display || name,
                    emoji: emoji || ''
                })
            });

            if (response.ok) {
                showCategoryStatus(`✓ Category "${name}" created successfully!`, 'success');
                
                // Clear form
                document.getElementById('new-category-name').value = '';
                document.getElementById('new-category-display').value = '';
                document.getElementById('new-category-emoji').value = '';
                
                // Reload category dropdown
                await loadCategoryDropdown();
                
                // Hide status after 3 seconds
                setTimeout(() => {
                    document.getElementById('category-add-status').style.display = 'none';
                }, 3000);
            } else {
                const error = await response.text();
                showCategoryStatus(`✗ Failed to create category: ${error}`, 'error');
            }
        } catch (error) {
            console.error('Error creating category:', error);
            showCategoryStatus('✗ Error creating category', 'error');
        }
    }

    // Show category add status
    function showCategoryStatus(message, type) {
        const statusEl = document.getElementById('category-add-status');
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.style.display = 'block';
        
        const bgColor = type === 'success' ? 'var(--accent)' : type === 'error' ? '#ef4444' : '#3b82f6';
        statusEl.style.backgroundColor = bgColor;
        statusEl.style.color = 'white';
    }

    // Public API
    return {
        init,
        testAlertSound,
        selectAllCategories,
        deselectAllCategories,
        getSettings,
        loadSettings,
        loadCategoryDropdown,
        addFeedRow,
        removeFeedRow,
        clearFeedForm,
        bulkAddFeeds,
        createCategory
    };
})();

// Export for global use
window.testAlertSound = SettingsModule.testAlertSound;
window.selectAllCategories = SettingsModule.selectAllCategories;
window.deselectAllCategories = SettingsModule.deselectAllCategories;
window.addFeedRow = SettingsModule.addFeedRow;
window.removeFeedRow = SettingsModule.removeFeedRow;
window.clearFeedForm = SettingsModule.clearFeedForm;
window.bulkAddFeeds = SettingsModule.bulkAddFeeds;
window.createCategory = SettingsModule.createCategory;

// Initialize category dropdown when add-feeds section is shown
document.addEventListener('DOMContentLoaded', () => {
    const settingsNavBtns = document.querySelectorAll('.settings-nav-btn');
    settingsNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.section === 'add-feeds') {
                SettingsModule.loadCategoryDropdown();
            }
        });
    });
});
