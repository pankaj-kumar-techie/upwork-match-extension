/**
 * Upwork Match Intelligence - Content Script
 * Responsibility: Extract job cards, compute scores, and inject premium UI badges.
 */

const DEBUG = true;
const log = (msg, data = '') => { if (DEBUG) console.log(`[MatchIntel] ${msg}`, data); };

const SELECTORS = {
  // Job Search Selectors
  JOB_TILE: 'section.job-tile, article.job-tile, [data-test="job-tile-list"] > section, [data-test="job-tile"]',
  TITLE: "h2.job-tile-title a, h3.job-tile-title a, .up-n-link, [data-test='job-tile-title-link']",
  DESCRIPTION: '.job-tile-description, [data-test="job-description"], .up-line-clamp-v3',
  JOB_TYPE: '[data-test="job-type"], .job-tile-info-list li:first-child',
  CLIENT_LOCATION: '[data-test="client-country"], .job-tile-location',
  CLIENT_PAYMENT: '[data-test="payment-verified"], .payment-verified, .up-icon-verified-check',
  CLIENT_SPEND: '[data-test="client-spend"], .client-spend, span[data-test="total-spent"]',
  CLIENT_HIRE_RATE: '[data-test="client-hire-rate"], .client-hire-rate',
  JOB_SKILLS: '.up-skill-badge, [data-test="skill"], [data-test="token"], .job-tile-skill, .air3-token',
  
  // Profile Selectors
  PROFILE_NAME: '[data-test="freelancer-name"], h1.m-0, h2.up-card-title, h1, .up-card-header h2',
  PROFILE_RATE: '[data-test="hourly-rate"] strong, .up-hourly-rate, .air3-display-inline-block strong, [data-test="rate"]',
  PROFILE_SKILLS: '[data-test="skill"], .up-skill-badge, .air3-token, .job-tile-skill',
  PROFILE_TITLE: '[data-test="title"], h2.up-card-title, .up-line-clamp-v2, h1',
  PROFILE_BIO: '[data-test="description"], .text-pre-line, .up-line-clamp-v5',
  PROFILE_HEADER: '.up-card-profile-header, [data-test="freelancer-profile-top"], .up-card-header, header.up-card-section',
  
  // Job Details / Modal Selectors
  PROPOSALS: '[data-test="proposals-tier"], .up-job-tile-proposals, [data-test="proposal-count"], .up-description-item li:nth-child(1)',
  CLIENT_FEEDBACK: '.up-review, [data-test="recent-history"] .up-review-content, .air3-review-content',
  MODAL_CONTAINER: '.up-slider, .air3-modal-content, [data-test="job-details-modal"], .up-modal-content',
  CLIENT_FEEDBACK_TEXT: '.up-review p, .up-review-content p, .air3-review-content p, .up-review-content',
  MODAL_ACTIVITY_LIST: '[data-test="activity-on-this-job"] li, .up-job-details-activity li, .air3-activity-list-item',
  MODAL_CLIENT_STATS: '[data-test="about-client-stat"], .up-job-details-client-stat, .air3-list-item',
  
  // Navigation
  NAV_PROFILE_LINK: '[data-test="nav-user-menu"] a[href*="/freelancers/~"], .nav-user-menu a[href*="/freelancers/~"], a.up-nav-link[href*="/freelancers/~"], a[href*="/freelancers/~"]'
};

class JobScorer {
  constructor(settings) {
    const defaults = {
      hourlyRateMin: 0,
      hourlyRateMax: 100,
      budgetMin: 0,
      keywords: [],
      locations: [],
      blacklistedLocations: [],
      minScoreToNotify: 85,
    };
    this.settings = { ...defaults, ...settings };
    
    // Ensure arrays are actually arrays (defensive coding)
    ['keywords', 'locations', 'blacklistedLocations'].forEach(key => {
        if (!Array.isArray(this.settings[key])) this.settings[key] = [];
    });
  }

  calculateScore(jobData) {
    let score = 35; // Base confidence score

    // 1. Critical Filter: Payment Verification (Core Trust)
    if (!jobData.paymentVerified) {
      score -= 20; // Heavy penalty for unverified payments - Professionals avoid these
    } else {
      score += 10; // Reward for verified payment
    }

    // 2. High Precision Skills & Keyword Match (Max +40%)
    const matchedKeywords = [];
    const profileKeywords = (this.settings.keywords || []).map(k => k.toLowerCase());
    const jobSkills = (jobData.jobSkills || []).map(s => s.toLowerCase());
    const jobText = `${jobData.title} ${jobData.description}`.toLowerCase();

    // Check direct skill overlaps
    const skillMatches = jobSkills.filter(skill => 
      profileKeywords.some(p => p.includes(skill) || skill.includes(p))
    );
    
    // Check keyword presence in text
    profileKeywords.forEach(kw => {
      if (jobText.includes(kw)) {
        matchedKeywords.push(kw);
      }
    });

    const uniqueMatches = new Set([...skillMatches, ...matchedKeywords]);
    const matchCount = uniqueMatches.size;
    const matchRatio = matchCount / Math.min(profileKeywords.length || 1, 10);
    score += Math.min(matchRatio * 40, 40);

    // 3. Financial Alignment (+15%)
    if (jobData.type === 'Hourly') {
      if (jobData.rateMin >= this.settings.hourlyRateMin && jobData.rateMax <= this.settings.hourlyRateMax) {
        score += 15;
      } else if (jobData.rateMax < this.settings.hourlyRateMin && jobData.rateMax > 0) {
        score -= 15; // Underpriced penalty
      } else if (jobData.rateMin >= this.settings.hourlyRateMin) {
        score += 10; // Floor met
      }
    } else if (jobData.type === 'Fixed-price') {
      if (jobData.budget >= this.settings.budgetMin) {
        score += 15;
      } else if (jobData.budget > 0 && jobData.budget < this.settings.budgetMin * 0.4) {
        score -= 10; // Deeply underpriced
      }
    }

    // 4. Client Maturity & Hire Rate (+15%)
    if (jobData.clientSpend.toLowerCase().includes('k') || jobData.clientSpend.toLowerCase().includes('m')) {
      score += 7;
    }
    if (jobData.hireRate > 75) {
      score += 8;
    } else if (jobData.hireRate < 30 && jobData.hireRate > 0) {
      score -= 10; // Low hire rate red flag
    }

    // 5. Geolocation Match (+10%)
    const userLocs = this.settings.locations || [];
    const locationMatched = userLocs.length > 0 && userLocs.some(loc => 
        jobData.location.toLowerCase().includes(loc.toLowerCase())
    );
    if (locationMatched) {
      score += 10;
    }

    // 6. Red Flags (Auto-Penalty)
    const blacklist = this.settings.blacklistedLocations || [];
    const isBlacklisted = blacklist.some(loc => 
        jobData.location.toLowerCase().includes(loc.toLowerCase())
    );
    if (isBlacklisted) score -= 30; // Heavy penalty for blacklisted locations

    if (jobData.proposals === '50+') score -= 25; // Saturated job penalty
    else if (jobData.proposals === '20 to 50') score -= 10;

    // 7. Success Multiplier (Freelancer Mention)
    if (jobData.freelancerMentioned) {
      score += 20; // Massive boost if client has worked with the user before
    }

    // 8. Deep Intelligence Boosts (God View)
    if (jobData.avgRating && parseFloat(jobData.avgRating) >= 4.5) score += 5;
    if (jobData.avgRatePaid) {
      const avgPaid = parseFloat(jobData.avgRatePaid.replace(/[^0-9.]/g, ''));
      if (avgPaid >= this.settings.hourlyRateMin) score += 10;
    }

    const finalScore = Math.max(0, Math.min(Math.round(score), 100));

    return {
      total: finalScore,
      matches: Array.from(uniqueMatches),
      locationMatched,
      isBlacklisted,
      highCompetition: jobData.proposals === '50+',
      freelancerMentioned: jobData.freelancerMentioned,
      paymentVerified: jobData.paymentVerified,
      advice: this.generateAlphaAdvice(finalScore, jobData, locationMatched, Array.from(uniqueMatches))
    };
  }

  generateAlphaAdvice(score, jobData, locMatched, matches) {
    const interviewing = parseInt(jobData.interviewing || 0);
    const invites = parseInt(jobData.invites || 0);
    const hasSync = this.settings.profileSummary?.title;
    
    let message = "📈 NEUTRAL ALPHA: Moderate alignment. Review details manually.";
    let rationale = "";

    // 1. Rationale Building
    const expertiseStr = matches.length > 5 ? "Strong" : (matches.length > 2 ? "Moderate" : "Weak");
    const budgetStr = (jobData.type === 'Hourly' && jobData.rateMin >= this.settings.hourlyRateMin) || 
                       (jobData.type === 'Fixed-price' && jobData.budget >= this.settings.budgetMin) ? "High" : "Low";
    rationale = `Expertise: ${expertiseStr} | Financial: ${budgetStr} Fit | Trust: ${jobData.paymentVerified ? 'Verified' : 'Low'}`;

    // 2. Message Logic
    if (jobData.freelancerMentioned) {
        message = "💎 COLLABORATION ALERT: Client has worked with you or similar profiles before. Priority bid.";
    } else if (interviewing > 5) {
        message = "⚠️ SATURATION WARNING: Client is already interviewing 5+ people. High risk of wasted effort.";
    } else if (invites > 10 && interviewing < 2) {
        message = "🚩 GHOST JOB? Client sent 10+ invites but is not interviewing. Likely inactive.";
    } else if (score >= 90) {
        message = invites < 3 ? "🔥 ALPHA SIGNAL: Prime opportunity. Low competition + High profile alignment. Bid now." : "⚡ HIGH ALPHA: Solid alignment and trust. Competitive bid recommended.";
    } else if (jobData.proposals === '50+') {
        message = "⚠️ FRICTION ALERT: Over-saturated (50+ proposals). Skip unless you are a 100% match.";
    } else if (!jobData.paymentVerified) {
        message = "🛑 TRUST WARNING: Payment unverified. High risk of project abandonment.";
    } else if (jobData.hireRate < 30 && jobData.hireRate > 0) {
        message = "⚠️ LOW HIRE RATE: Client rarely hires (<30%). Potential time-waster.";
    } else if (score < 45) {
        message = "📉 LOW YIELD: Poor economic or skill alignment. Recommended skip.";
    } else if (locMatched && score > 70) {
        message = "📍 MARKET ADVANTAGE: Region match + Solid Score. Local domain expertise advantage.";
    }

    if (hasSync && score > 80) {
        message = `✨ MATCH DETECTED for "${this.settings.profileSummary.title}": ` + message.split(': ')[1];
    }

    return { message, rationale };
  }
}

class UpworkEngine {
  constructor() {
    this.scorer = null;
    this.processedJobs = new Set();
    this.debounceTimer = null;
    this.init();
  }

  async init() {
    if (!chrome.runtime?.id) return;
    log('Initializing Engine...');
    try {
        const data = await chrome.storage.sync.get('settings');
        if (!chrome.runtime?.id) return;
        this.scorer = new JobScorer(data.settings);
    } catch (e) {
        log('Extension context invalidated during init.');
        return;
    }
    
    this.runCycle();

    const observer = new MutationObserver(() => {
      try {
        if (!chrome.runtime?.id) return;
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          try {
            if (!chrome.runtime?.id) return;
            this.runCycle();
          } catch (e) {}
        }, 600);
      } catch (e) {}
    });
    observer.observe(document.body, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      try {
        if (!chrome.runtime?.id) return;
        if (area === 'sync' && changes.settings) {
          log('Hot-reloading settings...');
          this.scorer.settings = changes.settings.newValue;
          this.setupAutoReload();
          document.querySelectorAll(SELECTORS.JOB_TILE).forEach(tile => {
              delete tile.dataset.matchProcessed;
          });
          this.runCycle();
        }
      } catch (e) {
        log('Context lost in storage listener');
      }
    });

    this.setupAutoReload();
  }

  setupAutoReload() {
    if (this.reloadTimeout) clearTimeout(this.reloadTimeout);
    const interval = this.scorer.settings.reloadInterval || 0;
    if (interval > 0) {
      log(`Auto-Reload scheduled in ${interval} minutes...`);
      this.reloadTimeout = setTimeout(() => {
          // Force reload even if hidden to keep feed fresh for when user returns
          window.location.reload();
      }, interval * 60 * 1000);
    }
  }

  runCycle() {
    if (!chrome.runtime?.id) return;
    const isProfile = window.location.href.includes('/freelancers/~');
    if (isProfile) {
      this.handleProfilePage();
      this.saveDetectedProfileUrl(window.location.href);
    } else {
      this.detectAndSaveProfileFromNav();
    }
    this.scanAndProcess();
    this.scrapeModalIfOpen();
    this.autoFetchDeepIntel(); // Background lazy-fetcher for God View
  }

  // LAZY BACKGROUND FETCHER - Automatically gets data for the "God View"
  async autoFetchDeepIntel() {
    const tiles = document.querySelectorAll(SELECTORS.JOB_TILE);
    for (const tile of tiles) {
       if (!chrome.runtime?.id) break;
       const link = tile.querySelector(SELECTORS.TITLE)?.href;
       if (!link || tile.dataset.miDeepProcessed) continue;

       const jobIdMatch = link.match(/~[0-9a-f]+/i);
       if (!jobIdMatch) continue;
       const jobId = jobIdMatch[0];

       // Check if we already have recent intel for this job
       let intelData;
       try {
           if (!chrome.runtime?.id) break;
           const result = await chrome.storage.local.get('deepIntel');
           if (!chrome.runtime?.id) break;
           intelData = result.deepIntel || {};
       } catch (e) { break; }

       const { deepIntel = intelData } = { deepIntel: intelData };
       if (deepIntel[jobId] && (new Date() - new Date(deepIntel[jobId].updated) < 3 * 60 * 60 * 1000)) {
           this.applyDeepIntelToTile(tile, deepIntel[jobId]);
           tile.dataset.miDeepProcessed = 'true';
           continue;
       }

       // Lazily fetch one at a time to avoid rate limits
       tile.dataset.miDeepProcessed = 'true';
       log(`Auto-fetching deep intel for ${jobId}...`);
       
       try {
           if (!chrome.runtime?.id) break;
           chrome.runtime.sendMessage({ type: 'FETCH_JOB_DETAILS', url: link }, (response) => {
              if (!chrome.runtime?.id) return;
              if (response?.html) {
                 const intel = this.parseIntelFromHtml(response.html);
                 this.syncDeepIntel(jobId, intel);
              }
           });
       } catch (e) { break; }

       // Wait a bit before next fetch to be "human-like"
       await new Promise(r => setTimeout(r, 5000));
    }
  }

  parseIntelFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const fullText = doc.body.innerText;

    // 1. Client Name (Heuristic scanning of technical reviews)
    let clientName = null;
    const feedbacks = doc.querySelectorAll('.up-review-content p, .air3-review-content p, .up-review-content');
    for (const fb of feedbacks) {
        const text = fb.textContent;
        // Search for "Thanks [Name]", "Great to work with [Name]", "[Name] was helpful"
        const nameMatch = text.match(/(?:hi|thanks|thank you|with|to|for|was)\s+([A-Z][a-z]+)/i);
        if (nameMatch && !['upwork', 'client', 'the', 'project'].includes(nameMatch[1].toLowerCase())) { 
            clientName = nameMatch[1]; 
            break; 
        }
    }

    // 2. Client Stats (More robust patterns for hire rate, spend, etc)
    const hireRateMatch = html.match(/(\d+)%\s*hire rate/i) || html.match(/hire rate:\s*(\d+)%/i);
    const spendMatch = html.match(/\$([0-9KkMm+.,]+)\s+(?:total spent|spent)/i) || html.match(/spent:\s*\$([0-9KkMm+.,]+)/i);
    const avgRateMatch = html.match(/\$([0-9.]+)\s+\/hr\s+avg hourly rate paid/i) || html.match(/avg hourly rate paid:\s*\$([0-9.]+)/i);
    const ratingMatch = html.match(/Rating is ([0-9.]+)/i) || html.match(/([45]\.[0-9])\s+of\s+5\s+stars/i) || html.match(/([\d\.]+)\s+Rating/i);
    const memberSinceMatch = html.match(/Member since ([A-Z][a-z]+ \d+, \d+)/i) || html.match(/Joined\s+([A-Z][a-z]+ \d+, \d+)/i);
    
    // 3. Location Extraction
    let location = null;
    const locMatch = html.match(/([A-Z][A-Za-z\s,]+)\d{1,2}:\d{2}\s+(?:AM|PM)/);
    if (locMatch) location = locMatch[1].trim().replace(/\s+$/, '');

    // 4. Activity on Job (More robust parsing)
    const activity = { interview: 0, invites: 0, proposals: '0' };
    
    // Pattern 1: Regex on full text (fastest & most reliable for SSR content)
    const intMatch = fullText.match(/Interviewing:\s*(\d+)/i);
    const invMatch = fullText.match(/Invites sent:\s*(\d+)/i);
    const propMatch = fullText.match(/Proposals:\s*([0-9\-\s\+to]+)/i);
    
    if (intMatch) activity.interview = parseInt(intMatch[1]);
    if (invMatch) activity.invites = parseInt(invMatch[1]);
    if (propMatch) activity.proposals = propMatch[1].trim();

    // Pattern 2: Selector fallback
    if (activity.interview === 0) {
        const activityItems = doc.querySelectorAll('[data-test="activity-on-this-job"] li, .up-job-details-activity li, .air3-activity-list-item');
        activityItems.forEach(li => {
            const txt = li.innerText.toLowerCase();
            if (txt.includes('interviewing')) activity.interview = parseInt(txt.match(/\d+/)?.[0] || 0);
            if (txt.includes('invites sent')) activity.invites = parseInt(txt.match(/\d+/)?.[0] || 0);
        });
    }

    return {
        clientName,
        location,
        hireRate: hireRateMatch ? parseInt(hireRateMatch[1]) : null,
        clientSpend: spendMatch ? "$" + spendMatch[1] : null,
        avgRatePaid: avgRateMatch ? "$" + avgRateMatch[1] : null,
        avgRating: ratingMatch ? ratingMatch[1] : null,
        memberSince: memberSinceMatch ? memberSinceMatch[1] : null,
        activity,
        updated: new Date().toISOString()
    };
  }

  scrapeModalIfOpen() {
    const modal = document.querySelector(SELECTORS.MODAL_CONTAINER);
    if (!modal || modal.dataset.miScraped) return;

    log('Deep Scanning Modal for Intelligence...');
    const intel = this.parseIntelFromHtml(modal.innerHTML);
    
    const currentUrl = window.location.href;
    const jobIdMatch = currentUrl.match(/~[0-9a-f]+/i);
    if (jobIdMatch) {
        this.syncDeepIntel(jobIdMatch[0], intel);
    }
    modal.dataset.miScraped = 'true';
  }

  async syncDeepIntel(jobId, intel) {
    if (!chrome.runtime?.id) return;
    const tiles = document.querySelectorAll(SELECTORS.JOB_TILE);
    tiles.forEach(tile => {
        const link = tile.querySelector(SELECTORS.TITLE)?.href || '';
        if (link.includes(jobId)) {
            this.applyDeepIntelToTile(tile, intel);
        }
    });

    try {
        const { deepIntel = {} } = await chrome.storage.local.get('deepIntel');
        deepIntel[jobId] = intel;
        if (chrome.runtime?.id) {
            await chrome.storage.local.set({ deepIntel });
        }
    } catch (e) {
        log('Context lost in syncDeepIntel');
    }
  }

  applyDeepIntelToTile(tile, intel) {
    if (!intel) return;
    tile.dataset.clientName = intel.clientName || '';
    tile.dataset.interviewing = intel.activity?.interview || '0';
    tile.dataset.invites = intel.activity?.invites || '0';
    tile.dataset.avgRatePaid = intel.avgRatePaid || '';
    tile.dataset.avgRating = intel.avgRating || '';
    tile.dataset.memberSince = intel.memberSince || '';
    if (intel.location) tile.dataset.locationBackfill = intel.location;
    if (intel.hireRate !== null) tile.dataset.hireRateBackfill = intel.hireRate;
    if (intel.clientSpend !== null) tile.dataset.spendBackfill = intel.clientSpend;
    
    tile.dataset.matchProcessed = 'true'; 
    tile.querySelectorAll('.match-intelligence-badge').forEach(b => b.remove());
    
    const jobData = this.extractJobData(tile);
    const result = this.scorer.calculateScore(jobData);
    this.injectBadge(tile, result.total, jobData, result.matches);
  }

  detectAndSaveProfileFromNav() {
    const profileLink = document.querySelector(SELECTORS.NAV_PROFILE_LINK);
    if (profileLink?.href) {
      this.saveDetectedProfileUrl(profileLink.href.split('?')[0]);
    }
  }

  async saveDetectedProfileUrl(url) {
    if (!chrome.runtime?.id) return;
    try {
        const { settings = {} } = await chrome.storage.sync.get('settings');
        if (settings.myProfileUrl !== url) {
          log('Saving detected profile URL:', url);
          await chrome.storage.sync.set({ settings: { ...settings, myProfileUrl: url } });
        }
    } catch (e) {
        log('Context lost in saveDetectedProfileUrl');
    }
  }

  async handleProfilePage() {
    if (!chrome.runtime?.id) return;
    if (document.getElementById('mi-profile-sync-btn')) return;

    try {
        const { settings = {} } = await chrome.storage.sync.get('settings');
        if (!chrome.runtime?.id) return;
        
        const currentUrl = window.location.href.split('?')[0];
        const isMyProfile = settings.myProfileUrl && currentUrl.includes(settings.myProfileUrl.split('?')[0].replace('~', ''));
        
        const header = document.querySelector(SELECTORS.PROFILE_HEADER);
        if (!header) return;

        const syncBtn = document.createElement('button');
        syncBtn.id = 'mi-profile-sync-btn';
        syncBtn.className = isMyProfile ? 'mi-sync-btn mi-premium' : 'mi-sync-btn';
        syncBtn.innerHTML = isMyProfile ? '⚡ Sync MY Intelligence' : 'Sync This Profile';

        syncBtn.onclick = () => this.syncProfile();
        header.appendChild(syncBtn);

        if (isMyProfile) {
          const lastSync = settings.profileSummary?.lastSync;
          const forceSync = window.location.search.includes('mi-force-sync');
          // ONE-TIME SYNC: Only auto-trigger if never synced OR explicitly forced
          if (forceSync || !lastSync) {
            if (chrome.runtime?.id) this.syncProfile();
          }
        }
    } catch (e) {
        log('Context invalidated in handleProfilePage');
    }
  }

  async syncProfile() {
    const btn = document.getElementById('mi-profile-sync-btn');
    if (btn) btn.innerHTML = '<span class="mi-spinner"></span> Analyzing Deeply...';

    const nameEl = document.querySelector(SELECTORS.PROFILE_NAME);
    const rateEl = document.querySelector(SELECTORS.PROFILE_RATE);
    const skillsEls = document.querySelectorAll(SELECTORS.PROFILE_SKILLS);
    const titleEl = document.querySelector(SELECTORS.PROFILE_TITLE);
    
    await new Promise(r => setTimeout(r, 2000));

    const profileName = nameEl?.textContent.trim() || '';
    const rateText = rateEl?.textContent || '0';
    const rate = parseInt(rateText.replace(/[^0-9]/g, '')) || 0;
    const skills = Array.from(skillsEls).map(el => el.textContent.trim()).filter(s => s);
    const title = titleEl?.textContent.trim() || '';

    const keywordPool = new Set([...skills, ...title.split(' ').filter(w => w.length > 3)]);

    try {
        const { settings = {} } = await chrome.storage.sync.get('settings');
        if (!chrome.runtime?.id) return;
        
        const updatedSettings = {
          ...settings,
          hourlyRateMin: Math.max(0, rate - 5),
          hourlyRateMax: rate + 20,
          keywords: Array.from(keywordPool).filter(k => k && k.length > 2).slice(0, 50),
          profileSummary: { lastSync: new Date().toISOString(), title, rate, profileName }
        };

        if (chrome.runtime?.id) {
            await chrome.storage.sync.set({ settings: updatedSettings });
            this.scorer.settings = updatedSettings;
        }
    } catch (e) {
        log('Context invalidated during syncProfile');
        return;
    }

    if (btn) {
      btn.innerHTML = `✅ ${skills.length} Data Points Synced!`;
      btn.style.background = '#10b981';
      setTimeout(() => {
        btn.innerHTML = '⚡ Sync MY Intelligence';
        btn.style.background = '';
      }, 3000);
    }
  }

  scanAndProcess() {
    const jobTiles = document.querySelectorAll(SELECTORS.JOB_TILE);
    jobTiles.forEach(tile => {
      if (tile.dataset.matchProcessed) return;
      
      const jobData = this.extractJobData(tile);
      if (jobData.title) {
        const result = this.scorer.calculateScore(jobData);
        this.injectBadge(tile, result.total, jobData, result.matches);
        tile.dataset.matchProcessed = 'true';
        if (result.total >= (this.scorer.settings.minScoreToNotify || 85)) {
           this.notifyHighMatch(jobData, result.total);
        }
      }
    });
  }

  extractJobData(tile) {
    const titleEl = tile.querySelector(SELECTORS.TITLE);
    const descEl = tile.querySelector(SELECTORS.DESCRIPTION);
    const typeEl = tile.querySelector(SELECTORS.JOB_TYPE);
    const locEl = tile.querySelector(SELECTORS.CLIENT_LOCATION);
    const paymentEl = tile.querySelector(SELECTORS.CLIENT_PAYMENT);
    const spendEl = tile.querySelector(SELECTORS.CLIENT_SPEND);
    const hireRateEl = tile.querySelector(SELECTORS.CLIENT_HIRE_RATE);
    const skillsEls = tile.querySelectorAll(SELECTORS.JOB_SKILLS);
    const proposalEl = tile.querySelector(SELECTORS.PROPOSALS);

    // --- EXTRACT PROPOSALS ---
    let proposals = "0";
    if (proposalEl) {
        proposals = proposalEl.textContent.trim().replace('Proposals: ', '');
    } else {
        const pMatch = tile.innerText.match(/Proposals:?\s*(\d+|50\+)/i);
        if (pMatch) proposals = pMatch[1];
    }

    // --- EXTRACT BUDGET/RATE ---
    let type = "Unknown";
    let budget = 0, rateMin = 0, rateMax = 0;
    const typeText = typeEl?.textContent || tile.innerText || "";
    
    if (typeText.includes("Hourly")) {
      type = "Hourly";
      const rates = typeText.match(/\$(\d+)/g);
      if (rates) {
        rateMin = parseInt(rates[0].replace("$", ""));
        rateMax = rates[1] ? parseInt(rates[1].replace("$", "")) : rateMin;
      }
    } else if (typeText.includes("Fixed-price") || typeText.includes("Budget")) {
      type = "Fixed-price";
      const budgetMatch = typeText.match(/Budget[:\s]*\$(\d+,?\d*)/i) || typeText.match(/\$(\d+,?\d*)/);
      if (budgetMatch) budget = parseInt(budgetMatch[1].replace(",", ""));
    }

    // --- EXTRACT CLIENT QUALITY ---
    // Hire Rate check
    let hireRate = tile.dataset.hireRateBackfill ? parseInt(tile.dataset.hireRateBackfill) : 0;
    const fullText = tile.innerText;
    if (hireRate === 0) {
        const hireRateMatch = fullText.match(/(\d+)% hire rate/i);
        if (hireRateMatch) {
            hireRate = parseInt(hireRateMatch[1]);
        } else if (hireRateEl) {
            const hrText = hireRateEl.textContent;
            const hrMatch = hrText.match(/(\d+)%/);
            if (hrMatch) hireRate = parseInt(hrMatch[1]);
        }
    }

    // Payment Verification check
    const paymentVerified = !!paymentEl || fullText.toLowerCase().includes('payment verified');

    // Spend check
    let clientSpend = tile.dataset.spendBackfill || spendEl?.textContent.trim() || "$0";
    if (clientSpend === "$0" || clientSpend === "") {
        const spendMatch = fullText.match(/\$([0-9KkMm+.,]+)\s+(?:total spent|spent)/i);
        if (spendMatch) clientSpend = "$" + spendMatch[1];
    }

    return {
      title: titleEl?.textContent.trim() || "Untitled Job",
      link: titleEl?.href || "",
      description: descEl?.textContent.trim() || "",
      type, budget, rateMin, rateMax,
      location: tile.dataset.locationBackfill || locEl?.textContent.trim() || "Remote",
      paymentVerified,
      clientSpend: clientSpend || "$0",
      hireRate,
      proposals,
      avgRating: tile.dataset.avgRating || null,
      avgRatePaid: tile.dataset.avgRatePaid || null,
      interviewing: tile.dataset.interviewing || 0,
      invites: tile.dataset.invites || 0,
      freelancerMentioned: tile.dataset.clientName ? true : false,
      jobSkills: Array.from(skillsEls).map(el => el.textContent.trim())
    };
  }

  injectBadge(tile, score, jobData, matches = []) {
    const result = this.scorer.calculateScore(jobData);
    const badge = document.createElement('div');
    badge.className = 'match-intelligence-badge premium';
    
    let color = '#ef4444';
    if (score >= 60) color = '#f59e0b';
    if (score >= 80) color = '#10b981';

    const matchedTags = matches.slice(0, 4).map(m => `<span class="mi-tag">${m}</span>`).join('');

    // Prepare Flags
    let flagsHtml = '';
    if (result.isBlacklisted) {
      flagsHtml += `<div class="mi-flag red-flag">🚩 RED FLAG LOCATION</div>`;
    }
    if (result.highCompetition) {
      flagsHtml += `<div class="mi-flag orange-flag">⚠️ OVER-SATURATED (50+)</div>`;
    }
    if (result.freelancerMentioned) {
      flagsHtml += `<div class="mi-flag green-flag">💎 PREVIOUS COLLABORATION</div>`;
    }

    badge.innerHTML = `
      <div class="mi-strategic-panel">
        <div class="mi-panel-sidebar" style="background: ${color}">
          <div class="mi-score-circle">${score}%</div>
          <div class="mi-alpha-label">ALPHA</div>
        </div>
        
        <div class="mi-panel-content">
          <div class="mi-advice-strip">${result.advice.message}</div>
          <div class="mi-match-rationale">${result.advice.rationale}</div>
          
          <div class="mi-dossier-grid">
            <div class="mi-dossier-item">
                <span class="label">CLIENT</span>
                <span class="value">${tile.dataset.clientName || 'ANONYMOUS'}</span>
            </div>
            <div class="mi-dossier-item">
                <span class="label">MARKET</span>
                <span class="value">📍 ${jobData.location.toUpperCase()}</span>
            </div>
             <div class="mi-dossier-item">
                <span class="label">ACTIVITY</span>
                <span class="value">${this.getActivityStatus(tile)}</span>
            </div>
            <div class="mi-dossier-item">
                <span class="label">HISTORY</span>
                <span class="value">${this.getHistoryStatus(tile, jobData)}</span>
            </div>
          </div>

          <div class="mi-intel-footer">
            <div class="mi-detail-chips">
                 ${jobData.avgRatePaid ? `<span class="mi-chip gold">${jobData.avgRatePaid} AVG PAID</span>` : ''}
                 ${jobData.avgRating ? `<span class="mi-chip">⭐ ${jobData.avgRating}</span>` : ''}
                 ${jobData.hireRate !== null ? `<span class="mi-chip ${jobData.hireRate < 30 && jobData.hireRate > 0 ? 'pulse red' : ''}">${jobData.hireRate}% HIRE</span>` : ''}
                 ${tile.dataset.invites && tile.dataset.invites !== '0' ? `<span class="mi-chip gold pulse">📩 ${tile.dataset.invites} INVITES</span>` : ''}
                 ${tile.dataset.interviewing && tile.dataset.interviewing !== '0' ? `<span class="mi-chip pulse">🔥 ${tile.dataset.interviewing} INTERVIEWING</span>` : ''}
            </div>
          </div>
        </div>

        <div class="mi-actions-container">
            <button class="mi-ai-action" title="AI Deep Dive">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z" /></svg>
            </button>
            <button class="mi-save-action" title="Track Opportunity">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z" /></svg>
            </button>
        </div>
      </div>
    `;

    badge.querySelector('.mi-save-action').onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      this.saveJob(jobData);
      e.currentTarget.style.color = '#10b981';
      e.currentTarget.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" /></svg>';
    };

    badge.querySelector('.mi-ai-action').onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        this.triggerAIInsight(tile, jobData);
    };

    tile.prepend(badge);
    const threshold = this.scorer.settings.minScoreToNotify || 85;
    if (score >= threshold) tile.classList.add('mi-high-match-v2');
  }

  async saveJob(jobData) {
    if (!chrome.runtime?.id) return;
    try {
        const { savedJobs = [] } = await chrome.storage.local.get("savedJobs");
        if (chrome.runtime?.id && !savedJobs.some((j) => j.link === jobData.link)) {
            savedJobs.push({ ...jobData, savedAt: new Date().toISOString() });
            await chrome.storage.local.set({ savedJobs });
        }
    } catch (e) {
        log('Context lost in saveJob');
    }
  }

  notifyHighMatch(jobData, score) {
    if (!chrome.runtime?.id) return;
    if (this.processedJobs.has(jobData.link)) return;
    this.processedJobs.add(jobData.link);
    chrome.runtime.sendMessage({ type: "NOTIFY_HIGH_MATCH", jobData, score });
  }

  getActivityStatus(tile) {
      const interview = parseInt(tile.dataset.interviewing || '0');
      const invites = parseInt(tile.dataset.invites || '0');
      if (interview > 0) return `🔥 ${interview} INTERVIEWING`;
      if (invites > 0) return `📩 ${invites} INVITES`;
      return 'QUIET';
  }

  getHistoryStatus(tile, jobData) {
      if (tile.dataset.memberSince) {
          const year = tile.dataset.memberSince.match(/\d{4}/)?.[0] || 'NEW';
          return `SINCE ${year}`;
      }
      return jobData.clientSpend !== '$0' ? 'ESTABLISHED' : 'NEW';
  }

  async triggerAIInsight(tile, jobData) {
      const btn = tile.querySelector('.mi-ai-action');
      const alphaSidebar = tile.querySelector('.mi-panel-sidebar');
      const scoreCircle = tile.querySelector('.mi-score-circle');
      const adviceStrip = tile.querySelector('.mi-advice-strip');

      if (btn.classList.contains('mi-loading')) return;
      if (!chrome.runtime?.id) return;

      btn.classList.add('mi-loading');
      adviceStrip.innerHTML = '<span class="mi-spinner"></span> Consultant is analyzing job depth...';
      
      try {
          if (!chrome.runtime?.id) throw new Error('Context lost');
          const { settings = {} } = await chrome.storage.sync.get('settings');
          
          if (!chrome.runtime?.id) throw new Error('Context lost');
          const response = await chrome.runtime.sendMessage({
              type: 'AI_GET_ALPHA_INSIGHT',
              jobData,
              profileSummary: {
                  title: settings.profileSummary?.title,
                  skills: settings.keywords, // Use keywords as the active skill set
                  rate: settings.profileSummary?.rate || settings.hourlyRateMin
              }
          });
          
          if (!chrome.runtime?.id) throw new Error('Context lost');

          const insight = response.insight;
          if (insight) {
              // Update UI with AI precision
              scoreCircle.innerHTML = `${insight.revisedScore}%`;
              adviceStrip.innerHTML = `<span class="mi-ai-badge">AI ANALYSIS</span> ${insight.alphaInsight}`;
              
              const content = tile.querySelector('.mi-panel-content');
              
              // 1. Add Strategic Winning Section
              let strategySection = content.querySelector('.mi-ai-strategy');
              if (!strategySection) {
                  strategySection = document.createElement('div');
                  strategySection.className = 'mi-ai-strategy';
                  content.insertBefore(strategySection, content.querySelector('.mi-intel-footer'));
              }
              strategySection.innerHTML = `
                <div class="mi-strategy-box">
                    <strong>Winning Strategy:</strong> ${insight.winningStrategy || "Be the first to highlight technical debt risks."}
                </div>
                <div class="mi-pitch-box">
                    <strong>Pitch Hook:</strong> "${insight.pitchHook}"
                </div>
              `;

              // 2. Add Red Flags if any
              if (insight.redFlags && insight.redFlags.length > 0) {
                  const footer = content.querySelector('.mi-intel-footer');
                  let redFlagList = content.querySelector('.mi-red-flags-list');
                  if (!redFlagList) {
                      redFlagList = document.createElement('div');
                      redFlagList.className = 'mi-red-flags-list';
                      content.insertBefore(redFlagList, footer);
                  }
                  redFlagList.innerHTML = insight.redFlags.map(f => `<span class="mi-red-flag-tag">🚩 ${f}</span>`).join('');
              }

              // Visual update
              alphaSidebar.style.background = insight.revisedScore >= 80 ? '#059669' : (insight.revisedScore >= 50 ? '#d97706' : '#dc2626');
              btn.style.color = '#10b981';
          }
      } catch (e) {
          adviceStrip.innerHTML = '❌ AI Engine Offline. Check settings.';
          log('AI Insight Failed', e);
      } finally {
          btn.classList.remove('mi-loading');
      }
  }
}

new UpworkEngine();
