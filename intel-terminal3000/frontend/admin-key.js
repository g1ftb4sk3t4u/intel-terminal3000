/**
 * Admin key handling for Intel Terminal 3000.
 *
 * The backend requires an X-Admin-Key header on every write endpoint (add
 * source, delete source, dashboards, keywords, settings, etc). This module
 * stores the key ONLY in this browser's localStorage (never in the shipped
 * JS, never sent anywhere except as that one header) and exposes helpers so
 * every write call site can attach it, plus a tiny UI so the site owner can
 * paste their key once instead of asking someone to redeploy for routine
 * things like starring an article.
 *
 * Visitors who never enter a key see a clean read-only page - admin-only
 * controls stay hidden via the `admin-unlocked` class on <body>, toggled by
 * whether a key is currently stored. Hiding the UI is a courtesy, not the
 * security boundary - the backend enforces the real check regardless of
 * what this file does.
 */
(function () {
    const STORAGE_KEY = 'intelAdminKey';

    function getAdminKey() {
        try {
            return localStorage.getItem(STORAGE_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function hasAdminKey() {
        return !!getAdminKey();
    }

    function setAdminKey(key) {
        try {
            if (key) {
                localStorage.setItem(STORAGE_KEY, key);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            // localStorage unavailable - key just won't persist this session.
        }
        applyUnlockState();
    }

    function clearAdminKey() {
        setAdminKey('');
    }

    // Merge X-Admin-Key into an existing headers object/Headers instance.
    function withAdminHeader(headers) {
        const key = getAdminKey();
        if (!key) return headers || {};
        if (headers instanceof Headers) {
            headers.set('X-Admin-Key', key);
            return headers;
        }
        return Object.assign({}, headers || {}, { 'X-Admin-Key': key });
    }

    function applyUnlockState() {
        document.body.classList.toggle('admin-unlocked', hasAdminKey());
    }

    async function verifyAdminKey(key) {
        const base = window.API_BASE || '';
        try {
            const resp = await fetch(`${base}/api/admin/check`, {
                headers: { 'X-Admin-Key': key },
            });
            return resp.ok;
        } catch (e) {
            return false;
        }
    }

    // Prompts for a key, verifies it against the backend before storing
    // anything (so a typo or wrong key never gets saved as if it worked),
    // and returns whether unlock succeeded.
    async function promptUnlock() {
        const candidate = window.prompt('Enter admin key:');
        if (!candidate) return false;
        const ok = await verifyAdminKey(candidate.trim());
        if (ok) {
            setAdminKey(candidate.trim());
        } else {
            window.alert('Invalid admin key.');
        }
        return ok;
    }

    window.AdminKey = {
        getAdminKey,
        hasAdminKey,
        setAdminKey,
        clearAdminKey,
        withAdminHeader,
        verifyAdminKey,
        promptUnlock,
    };

    document.addEventListener('DOMContentLoaded', applyUnlockState);
})();
