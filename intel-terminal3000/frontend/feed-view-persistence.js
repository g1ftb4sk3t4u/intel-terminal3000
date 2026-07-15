/* Intel Terminal 3000 — persistent global feed presentation */
(() => {
    'use strict';

    const STORAGE_KEY = 'intel-v2-feed-view';
    const VALID_MODES = new Set(['tiled', 'irc']);
    const retryTimers = new Set();
    let dashboardObserver = null;
    let applyQueued = false;
    let applying = false;

    function normalize(mode) {
        return VALID_MODES.has(mode) ? mode : 'tiled';
    }

    function getPreferredMode() {
        return normalize(localStorage.getItem(STORAGE_KEY) || 'tiled');
    }

    function savePreferredMode(mode) {
        const normalized = normalize(mode);
        localStorage.setItem(STORAGE_KEY, normalized);
        return normalized;
    }

    function syncGlobalControls(mode) {
        document.body.dataset.feedMode = mode;
        document.querySelectorAll('[data-feed-mode]').forEach(button => {
            const selected = button.dataset.feedMode === mode;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
    }

    function panelNeedsRefresh(panel, mode) {
        const content = panel.querySelector('.panel-content');
        if (!content) return false;

        const hasIRC = Boolean(content.querySelector('.irc-feed-list'));
        const hasTiles = Boolean(content.querySelector('.article-list'));

        if (mode === 'irc') return hasTiles && !hasIRC;
        return hasIRC && !hasTiles;
    }

    function applyPreferredMode() {
        if (applying) return;
        applying = true;

        try {
            const mode = getPreferredMode();
            syncGlobalControls(mode);

            document.querySelectorAll('#dashboardContainer .panel[data-module="feed"]').forEach(panel => {
                const selector = panel.querySelector('.feed-view-toggle');
                if (!selector) return;

                const selectorChanged = selector.value !== mode;
                const contentMismatch = panelNeedsRefresh(panel, mode);

                if (selectorChanged) selector.value = mode;

                if ((selectorChanged || contentMismatch) && typeof window.setFeedView === 'function') {
                    window.setFeedView(panel.id, mode);
                }
            });
        } finally {
            applying = false;
        }
    }

    function queueApply(delay = 0) {
        const timer = window.setTimeout(() => {
            retryTimers.delete(timer);
            if (applyQueued) return;
            applyQueued = true;
            window.requestAnimationFrame(() => {
                applyQueued = false;
                applyPreferredMode();
            });
        }, delay);
        retryTimers.add(timer);
    }

    function scheduleRestoreBurst() {
        [0, 50, 150, 350, 750, 1500, 3000].forEach(queueApply);
    }

    function wrapPanelSetter() {
        const original = window.setFeedView;
        if (typeof original !== 'function' || original.__intelPersistentFeedView) return;

        const wrapped = function(panelId, mode) {
            const normalized = savePreferredMode(mode);
            syncGlobalControls(normalized);
            return original.call(this, panelId, normalized);
        };

        wrapped.__intelPersistentFeedView = true;
        wrapped.__intelOriginal = original;
        window.setFeedView = wrapped;
    }

    function bindPreferenceEvents() {
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-feed-mode]');
            if (!button) return;
            savePreferredMode(button.dataset.feedMode);
            scheduleRestoreBurst();
        }, true);

        document.addEventListener('change', event => {
            const selector = event.target.closest('.feed-view-toggle');
            if (!selector) return;
            savePreferredMode(selector.value);
            scheduleRestoreBurst();
        }, true);
    }

    function observeDashboard() {
        const dashboard = document.getElementById('dashboardContainer');
        if (!dashboard) {
            queueApply(100);
            return;
        }

        dashboardObserver?.disconnect();
        dashboardObserver = new MutationObserver(() => queueApply(20));
        dashboardObserver.observe(dashboard, { childList: true, subtree: true });
    }

    function init() {
        wrapPanelSetter();
        bindPreferenceEvents();
        observeDashboard();
        scheduleRestoreBurst();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.addEventListener('pageshow', scheduleRestoreBurst);
    window.addEventListener('beforeunload', () => {
        dashboardObserver?.disconnect();
        retryTimers.forEach(timer => window.clearTimeout(timer));
        retryTimers.clear();
    });
})();
