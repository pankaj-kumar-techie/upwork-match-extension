/**
 * Upwork Match Intelligence - Background Script
 * Responsibility: Handle webhooks and persistent notifications.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NOTIFY_HIGH_MATCH') {
    handleHighMatch(message.jobData, message.score);
  } else if (message.type === 'FETCH_JOB_DETAILS') {
    fetch(message.url)
      .then(response => response.text())
      .then(html => sendResponse({ html }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Handle notification click to open the job link
chrome.notifications.onClicked.addListener((notificationId) => {
    // notificationId is the job link we stored as the ID
    if (notificationId.startsWith('https://')) {
        chrome.tabs.create({ url: notificationId });
    }
});

async function handleHighMatch(jobData, score) {
  const { settings = {} } = await chrome.storage.sync.get('settings');
  
  // 1. Show dynamic notification
  chrome.notifications.create(jobData.link, { // Use link as ID
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `🚀 High Match (${score}%)`,
    message: jobData.title,
    contextMessage: "Click to open job and apply",
    priority: 2
  });

  // 2. Auto-Save to Tracker (MNC Grade Automation)
  if (settings.autoSaveEnabled !== false) {
    log(`Auto-saving high match job: ${jobData.title}`);
    const { savedJobs = [] } = await chrome.storage.local.get('savedJobs');
    if (!savedJobs.some(j => j.link === jobData.link)) {
        savedJobs.push({ 
            ...jobData, 
            score,
            savedAt: new Date().toISOString(),
            isAutoSaved: true 
        });
        await chrome.storage.local.set({ savedJobs });
    }
  }

  // 3. Webhook handling
  if (settings.webhookUrl) {
    sendWebhook(settings.webhookUrl, jobData, score);
  }
}

function log(msg) {
    console.log(`[Background] ${msg}`);
}

async function sendWebhook(url, jobData, score) {
  const payload = {
    content: `🚀 **High Match Job Found (${score}%)**\n\n**Title:** ${jobData.title}\n**Budget:** ${jobData.type === 'Hourly' ? `$${jobData.rateMin}-$${jobData.rateMax}/hr` : `$${jobData.budget}`}\n**Location:** ${jobData.location}\n\n[View Job](${jobData.link})`,
    username: "Upwork Match Intelligence"
  };

  // Check if it's Telegram
  if (url.includes('api.telegram.org')) {
    // Telegram format: { chat_id, text, parse_mode }
    const chatIdMatch = url.match(/chat_id=([^&]+)/);
    const chatId = chatIdMatch ? chatIdMatch[1] : '';
    const telegramUrl = url.split('?')[0]; // bot token url
    
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🚀 *High Match Job Found (${score}%)*\n\n*Title:* ${jobData.title}\n*Budget:* ${jobData.type === 'Hourly' ? `$${jobData.rateMin}-$${jobData.rateMax}/hr` : `$${jobData.budget}`}\n*Location:* ${jobData.location}\n\n[View Job](${jobData.link})`,
        parse_mode: 'Markdown'
      })
    });
  } else {
    // Default Discord/Generic format
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
}
