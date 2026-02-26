/**
 * Upwork Match Intelligence - Popup Controller
 * Responsibility: Handle tab switching, settings persistence, and tracker display.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const tabSettings = document.getElementById('tab-settings');
    const tabTracker = document.getElementById('tab-tracker');
    const settingsView = document.getElementById('settings-view');
    const trackerView = document.getElementById('tracker-view');
    const saveBtn = document.getElementById('save-settings');
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
    document.getElementById('reloadInterval').value = settings.reloadInterval || 0;
    document.getElementById('autoSaveEnabled').checked = settings.autoSaveEnabled !== false;
    document.getElementById('aiModel').value = settings.aiModel || 'none';
    document.getElementById('aiKey').value = settings.aiKey || '';

    // Calibration Triggers
    const triggerSync = () => {
        let url = settings.myProfileUrl || 'https://www.upwork.com/nx/find-work/';
        if (url.includes('?')) url += '&mi-force-sync=true';
        else url += '?mi-force-sync=true';
        chrome.tabs.create({ url });
    };

    openProfileBtn.onclick = triggerSync;
    resyncBtn.onclick = triggerSync;

    // Save Configurations
    saveBtn.onclick = async () => {
        const newSettings = {
            myProfileUrl: document.getElementById('myProfileUrl').value.trim(),
            hourlyRateMin: parseInt(document.getElementById('hourlyRateMin').value) || 0,
            hourlyRateMax: parseInt(document.getElementById('hourlyRateMax').value) || 0,
            budgetMin: parseInt(document.getElementById('budgetMin').value) || 0,
            keywords: document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k),
            locations: document.getElementById('locations').value.split(',').map(l => l.trim()).filter(l => l),
            blacklistedLocations: document.getElementById('blacklistedLocations').value.split(',').map(l => l.trim()).filter(l => l),
            minScoreToNotify: parseInt(document.getElementById('minScoreToNotify').value) || 85,
            reloadInterval: parseInt(document.getElementById('reloadInterval').value) || 0,
            autoSaveEnabled: document.getElementById('autoSaveEnabled').checked,
            aiModel: document.getElementById('aiModel').value,
            aiKey: document.getElementById('aiKey').value.trim()
        };

        const finalSettings = { ...settings, ...newSettings };
        await chrome.storage.sync.set({ settings: finalSettings });
        
        saveBtn.innerText = '✨ Configurations Deployed!';
        saveBtn.style.background = '#10b981';
        
        setTimeout(() => {
            saveBtn.innerText = 'Deploy Configurations';
            saveBtn.style.background = '';
        }, 2500);
    };

    async function loadSavedJobs() {
        const { savedJobs = [] } = await chrome.storage.local.get('savedJobs');
        const container = document.getElementById('saved-jobs-list');
        
        if (savedJobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="icon">🔍</span>
                    <p>No high-alpha opportunities tracked yet.</p>
                </div>`;
            return;
        }

        container.innerHTML = savedJobs.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)).map(job => {
            let color = '#ef4444';
            if (job.score >= 60) color = '#f59e0b';
            if (job.score >= 80) color = '#10b981';

            return `
            <div class="job-card">
                <div class="job-header">
                    <a href="${job.link}" target="_blank" style="text-decoration: none; flex: 1;">
                        <h4>${job.title}</h4>
                    </a>
                    <span class="score-pill" style="background: ${color}">${job.score || '??'}%</span>
                </div>
                <p>${job.description.substring(0, 140)}...</p>
                <div class="job-meta">
                    <span>${job.type} &bull; ${job.type === 'Fixed-price' ? (job.budget ? '$' + job.budget : 'Budget TBD') : (job.rateMin ? '$' + job.rateMin + '-' + job.rateMax + '/hr' : 'Rate TBD')}</span>
                    <span style="color: ${job.paymentVerified ? '#10b981' : '#94a3b8'}">${job.paymentVerified ? 'Verified' : 'Unverified'}</span>
                </div>
                <div class="job-footer">
                    <span class="save-date">Hire Rate: ${job.hireRate}% &bull; Tracked: ${new Date(job.savedAt).toLocaleDateString()}</span>
                    ${job.isAutoSaved ? '<span class="auto-save-tag">Intelligence Auto-Save</span>' : ''}
                </div>
            </div>
        `}).join('');
    }
});
