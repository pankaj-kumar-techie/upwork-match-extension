/**
 * Upwork Match Intelligence - Popup Controller
 * Responsibility: Handle tab switching, settings persistence, and tracker display.
 *
 * Privacy note: all settings live in chrome.storage (your browser). The AI API key
 * is kept in storage.local (never cloud-synced). There is no backend server.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const tabSettings = document.getElementById('tab-settings');
    const tabTracker = document.getElementById('tab-tracker');
    const settingsView = document.getElementById('settings-view');
    const trackerView = document.getElementById('tracker-view');
    const saveBtn = document.getElementById('save-settings');
    const resetBtn = document.getElementById('reset-settings');
    const openProfileBtn = document.getElementById('open-profile-btn');

    // Tab Switching Logic
    tabSettings.onclick = () => {
        tabSettings.classList.add('active');
        tabTracker.classList.remove('active');
        settingsView.style.display = 'flex';
        trackerView.style.display = 'none';
    };

    tabTracker.onclick = () => {
        tabTracker.classList.add('active');
        tabSettings.classList.remove('active');
        trackerView.style.display = 'flex';
        settingsView.style.display = 'none';
        loadSavedJobs();
    };

    // Load Existing Settings
    const { settings = {} } = await chrome.storage.sync.get('settings');
    // API key lives in local storage; fall back to legacy synced value for migration.
    const { aiKey: localAiKey = '' } = await chrome.storage.local.get('aiKey');
    const notice = document.getElementById('quick-start-notice');
    const statusCard = document.getElementById('profile-status-card');
    const resyncBtn = document.getElementById('resync-profile-btn');

    // UI State Management (Onboarding vs Calibrated)
    if (settings.profileSummary?.lastSync) {
        notice.style.display = 'none';
        statusCard.style.display = 'block';
        document.getElementById('profile-name').innerText = settings.profileSummary.profileName || 'Anonymous Intel';
        document.getElementById('profile-title').innerText = settings.profileSummary.title || 'Generalist';
    } else {
        notice.style.display = 'block';
        statusCard.style.display = 'none';
    }

    // Populate Fields
    document.getElementById('myProfileUrl').value = settings.myProfileUrl || '';
    document.getElementById('hourlyRateMin').value = settings.hourlyRateMin || '';
    document.getElementById('hourlyRateMax').value = settings.hourlyRateMax || '';
    document.getElementById('budgetMin').value = settings.budgetMin || '';
    document.getElementById('keywords').value = (settings.keywords || []).join(', ');
    document.getElementById('locations').value = (settings.locations || []).join(', ');
    document.getElementById('blacklistedLocations').value = (settings.blacklistedLocations || []).join(', ');
    document.getElementById('minScoreToNotify').value = settings.minScoreToNotify || 85;
    document.getElementById('webhookUrl').value = settings.webhookUrl || '';
    document.getElementById('aiModel').value = settings.aiModel || 'none';
    document.getElementById('aiKey').value = localAiKey || settings.aiKey || '';

    // Live parse hints for comma-separated fields
    const keywordsEl = document.getElementById('keywords');
    const locationsEl = document.getElementById('locations');
    const keywordsHint = document.getElementById('keywords-hint');
    const locationsHint = document.getElementById('locations-hint');
    const countItems = (v) => v.split(',').map(s => s.trim()).filter(Boolean).length;
    const updateHints = () => {
        const k = countItems(keywordsEl.value);
        const l = countItems(locationsEl.value);
        keywordsHint.innerText = k ? `${k} keyword${k > 1 ? 's' : ''} detected` : '';
        locationsHint.innerText = l ? `${l} region${l > 1 ? 's' : ''} detected` : '';
    };
    keywordsEl.addEventListener('input', updateHints);
    locationsEl.addEventListener('input', updateHints);
    updateHints();

    // Calibration Triggers
    const profileUrlEl = document.getElementById('myProfileUrl');
    const profileUrlHint = document.getElementById('profile-url-hint');
    const triggerSync = () => {
        const url = (profileUrlEl.value || settings.myProfileUrl || '').trim();
        // Don't open a dead tab — a non-profile URL has nothing to sync from.
        if (!url || !url.includes('/freelancers/~')) {
            tabSettings.onclick();
            profileUrlEl.focus();
            profileUrlEl.classList.add('field-error');
            profileUrlHint.innerText = '⚠️ Paste your public profile URL (…/freelancers/~…) first, then Sync.';
            profileUrlHint.classList.add('error');
            return;
        }
        const sep = url.includes('?') ? '&' : '?';
        chrome.tabs.create({ url: url + sep + 'mi-force-sync=true' });
    };
    profileUrlEl.addEventListener('input', () => {
        profileUrlEl.classList.remove('field-error');
        profileUrlHint.classList.remove('error');
        profileUrlHint.innerText = '';
    });

    openProfileBtn.onclick = triggerSync;
    resyncBtn.onclick = triggerSync;

    // Save Configurations
    saveBtn.onclick = async () => {
        const aiKey = document.getElementById('aiKey').value.trim();
        const newSettings = {
            myProfileUrl: document.getElementById('myProfileUrl').value.trim(),
            hourlyRateMin: parseInt(document.getElementById('hourlyRateMin').value) || 0,
            hourlyRateMax: parseInt(document.getElementById('hourlyRateMax').value) || 0,
            budgetMin: parseInt(document.getElementById('budgetMin').value) || 0,
            keywords: document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k),
            locations: document.getElementById('locations').value.split(',').map(l => l.trim()).filter(l => l),
            blacklistedLocations: document.getElementById('blacklistedLocations').value.split(',').map(l => l.trim()).filter(l => l),
            minScoreToNotify: parseInt(document.getElementById('minScoreToNotify').value) || 85,
            webhookUrl: document.getElementById('webhookUrl').value.trim(),
            aiModel: document.getElementById('aiModel').value
        };

        // Keep the secret out of cloud-synced storage.
        const finalSettings = { ...settings, ...newSettings };
        delete finalSettings.aiKey;

        try {
            await chrome.storage.local.set({ aiKey });
            await chrome.storage.sync.set({ settings: finalSettings });
            Object.assign(settings, finalSettings);

            saveBtn.innerText = '✨ Configurations Deployed!';
            saveBtn.style.background = '#10b981';
            setTimeout(() => {
                saveBtn.innerText = 'Deploy Configurations';
                saveBtn.style.background = '';
            }, 2500);
        } catch (e) {
            saveBtn.innerText = '⚠️ Save failed — try again';
            saveBtn.style.background = '#dc2626';
            setTimeout(() => {
                saveBtn.innerText = 'Deploy Configurations';
                saveBtn.style.background = '';
            }, 3000);
        }
    };

    // Reset all settings
    resetBtn.onclick = async () => {
        if (!confirm('Reset all settings, your synced profile, and tracked jobs? This cannot be undone.')) return;
        try {
            await chrome.storage.sync.clear();
            await chrome.storage.local.clear();
            window.location.reload();
        } catch (e) {
            resetBtn.innerText = 'Reset failed';
        }
    };

    async function removeSavedJob(link) {
        const { savedJobs = [] } = await chrome.storage.local.get('savedJobs');
        const next = savedJobs.filter(j => j.link !== link);
        await chrome.storage.local.set({ savedJobs: next });
        loadSavedJobs();
    }

    function buildBreakdown(contributions) {
        const items = (contributions || []).filter(c => c.delta !== 0)
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 6);
        if (items.length === 0) return '';
        const rows = items.map(c => {
            const pos = c.delta > 0;
            return `<div class="bd-row"><span class="bd-delta ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${Math.round(c.delta)}</span><span class="bd-label">${escapeHtml(c.label)}</span></div>`;
        }).join('');
        return `<details class="bd"><summary>Why this score?</summary><div class="bd-body">${rows}</div></details>`;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function loadSavedJobs() {
        const { savedJobs = [] } = await chrome.storage.local.get('savedJobs');
        const container = document.getElementById('saved-jobs-list');

        if (savedJobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="icon">🔖</span>
                    <p>No jobs tracked yet. Open an Upwork jobs feed and click the bookmark icon on any scored card to save it here.</p>
                </div>`;
            return;
        }

        container.innerHTML = savedJobs
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
            .map(job => {
                const score = (typeof job.score === 'number') ? job.score : null;
                let color = '#94a3b8';
                if (score !== null) {
                    color = '#ef4444';
                    if (score >= 60) color = '#f59e0b';
                    if (score >= 80) color = '#10b981';
                }
                const desc = job.description ? escapeHtml(job.description.substring(0, 140)) + '…' : 'No description captured.';
                const budgetLine = job.type === 'Fixed-price'
                    ? (job.budget ? '$' + job.budget : 'Budget TBD')
                    : (job.rateMin ? '$' + job.rateMin + '-' + (job.rateMax || job.rateMin) + '/hr' : 'Rate TBD');
                const savedDate = job.savedAt ? new Date(job.savedAt).toLocaleDateString() : '';
                const hireRate = (job.hireRate !== null && job.hireRate !== undefined) ? job.hireRate + '%' : 'N/A';

                return `
                <div class="job-card" data-link="${escapeHtml(job.link)}">
                    <div class="job-header">
                        <a href="${escapeHtml(job.link)}" target="_blank" style="text-decoration: none; flex: 1;">
                            <h4>${escapeHtml(job.title || 'Untitled Job')}</h4>
                        </a>
                        <span class="score-pill" style="background: ${color}">${score !== null ? score + '%' : '—'}</span>
                        <button class="remove-job-btn" title="Remove" data-link="${escapeHtml(job.link)}">✕</button>
                    </div>
                    <p>${desc}</p>
                    <div class="job-meta">
                        <span>${escapeHtml(job.type || 'Unknown')} &bull; ${budgetLine}</span>
                        <span style="color: ${job.paymentVerified ? '#10b981' : '#94a3b8'}">${job.paymentVerified ? 'Verified' : 'Unverified'}</span>
                    </div>
                    ${buildBreakdown(job.contributions)}
                    <div class="job-footer">
                        <span class="save-date">Hire Rate: ${hireRate} &bull; Tracked: ${savedDate}</span>
                        ${job.isAutoSaved ? '<span class="auto-save-tag">Intelligence Auto-Save</span>' : ''}
                    </div>
                </div>
            `;
            }).join('');

        container.querySelectorAll('.remove-job-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeSavedJob(btn.dataset.link);
            };
        });
    }
});
