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
  } else if (message.type === 'AI_GET_ALPHA_INSIGHT') {
    handleAIRequest(message.jobData, message.profileSummary)
      .then(insight => sendResponse({ insight }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

async function handleAIRequest(jobData, profileSummary) {
    const { settings = {} } = await chrome.storage.sync.get('settings');
    const model = settings.aiModel;
    const apiKey = settings.aiKey;

    if (!model || model === 'none' || !apiKey) {
        throw new Error('AI Model or API Key not configured in popup.');
    }

    const systemPrompt = `You are an elite MNC Technical Lead and Senior Talent Consultant. Your goal is to analyze an Upwork job post to save a Developer's time and help them win the proposal with professional precision.

FREELANCER DNA:
- Identity: ${profileSummary?.title || 'Senior Software Engineer'}
- Expertise Matrix: ${profileSummary?.skills?.join(', ') || 'Generalist'}
- Economic Floor: $${profileSummary?.rate || '0'}/hr

INPUT JOB DATA:
- Job Title: ${jobData.title}
- High-Level Requirements: ${jobData.description}
- Client Financial Velocity: ${jobData.type === 'Hourly' ? `$${jobData.rateMin}-$${jobData.rateMax}/hr` : `$${jobData.budget}`}

REQUIRED OUTPUT (JSON OBJECT ONLY):
{
  "revisedScore": number (0-100, purely technical and financial alignment),
  "alphaInsight": "A single sentence explaining why this is or isn't a high-yield opportunity for a developer of this caliber.",
  "winningStrategy": "Tactical advice on WHAT to mention in the proposal to instantly stand out (e.g., hidden tech debt, architecture risks, or specific framework nuances).",
  "pitchHook": "The first 2 sentences of a cover letter that proves high-alpha expertise instantly. No fluff.",
  "redFlags": ["List specific technical or operational red flags found in the text."]
}

CRITICAL: Be extremely honest. If the job is a time-waster, lower the revisedScore and explain why in alphaInsight. Focus on SAVING the developer's time.`;

    if (model === 'gemini') {
        return callGemini(apiKey, systemPrompt);
    } else if (model === 'openai') {
        return callOpenAI(apiKey, systemPrompt);
    }
}

async function callGemini(key, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt + "\nRespond ONLY with a valid JSON object." }] }],
            generationConfig: { responseMimeType: "application/json" }
        })
    });
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
}

async function callOpenAI(key, prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that responds in JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" }
        })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

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
