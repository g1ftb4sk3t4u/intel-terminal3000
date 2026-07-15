/* Intel Terminal 3000 — command center integration helpers */
(() => {
    'use strict';

    function init() {
        installDashboardSwitcher();
        installUtilityButtons();
        bindPanelFocus();
        document.addEventListener('intelthemechange', refreshChartTheme);
    }

    function installDashboardSwitcher() {
        const selector = document.getElementById('dashboardSelector');
        const search = document.getElementById('intelGlobalSearch');
        if (!selector || !search || document.querySelector('.intel-dashboard-switcher')) return;

        const wrapper = document.createElement('label');
        wrapper.className = 'intel-dashboard-switcher';
        wrapper.innerHTML = '<span>Dashboard</span>';
        wrapper.appendChild(selector);
        search.after(wrapper);
    }

    function installUtilityButtons() {
        const quick = document.querySelector('.intel-topbar-quick');
        if (!quick || quick.dataset.utilitiesReady === 'true') return;
        quick.dataset.utilitiesReady = 'true';

        const help = document.createElement('button');
        help.type = 'button';
        help.className = 'intel-icon-button';
        help.title = 'Help and keyboard shortcuts';
        help.setAttribute('aria-label', help.title);
        help.textContent = '?';
        help.addEventListener('click', () => window.openModal?.('helpModal'));

        const admin = document.createElement('button');
        admin.type = 'button';
        admin.className = 'intel-user-button';
        admin.title = 'Toggle administrator controls';
        admin.innerHTML = '<span>OPS</span><strong>Admin</strong>';
        admin.addEventListener('click', () => {
            document.getElementById('loginToggle')?.click();
            admin.classList.toggle('active');
        });

        quick.prepend(help);
        quick.appendChild(admin);
    }

    function bindPanelFocus() {
        const dashboard = document.getElementById('dashboardContainer');
        if (!dashboard || dashboard.dataset.focusBinding === 'true') return;
        dashboard.dataset.focusBinding = 'true';
        dashboard.addEventListener('click', event => {
            const title = event.target.closest('.panel-title');
            if (!title || event.target.closest('.drag-handle')) return;
            const panel = title.closest('.panel');
            if (!panel || typeof window.togglePanelExpand !== 'function') return;
            window.togglePanelExpand(panel.id);
        });
    }

    function refreshChartTheme() {
        const chartApi = window.Chart;
        const instances = chartApi?.instances;
        if (!instances) return;
        const styles = getComputedStyle(document.body);
        const text = styles.getPropertyValue('--text-secondary').trim() || '#a8bfd2';
        const grid = styles.getPropertyValue('--intel-line-soft').trim() || 'rgba(93,137,170,.18)';
        const accent = styles.getPropertyValue('--intel-accent').trim() || '#42d9ff';

        Object.values(instances).forEach(chart => {
            if (!chart?.options) return;
            const scales = chart.options.scales || {};
            Object.values(scales).forEach(scale => {
                if (!scale) return;
                scale.ticks = { ...(scale.ticks || {}), color: text };
                scale.grid = { ...(scale.grid || {}), color: grid };
            });
            chart.options.plugins = chart.options.plugins || {};
            chart.options.plugins.legend = chart.options.plugins.legend || {};
            chart.options.plugins.legend.labels = { ...(chart.options.plugins.legend.labels || {}), color: text };
            chart.data?.datasets?.forEach((dataset, index) => {
                if (index === 0 && !dataset.borderColor) dataset.borderColor = accent;
            });
            chart.update('none');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
