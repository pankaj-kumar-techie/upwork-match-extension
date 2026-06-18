/**
 * Upwork Match Intelligence - Content Script
 * Responsibility: Extract job cards, compute scores, and inject premium UI badges.
 */

const DEBUG = true;
const log = (msg, data = '') => { if (DEBUG) console.log(`[MatchIntel] ${msg}`, data); };

const SELECTORS = {
  // Job Search Selectors
  JOB_TILE: 'section.job-tile, article.job-tile, [data-test="job-tile-list"] > section, [data-test="job-tile"], .air3-card-section.job-tile-list, .air3-card-section.job-tile, .job-tile-list > *',
  TITLE: "h2.job-tile-title a, h3.job-tile-title a, .up-n-link, [data-test='job-tile-title-link'], .job-tile-title a, [data-test='job-tile-list'] a, .job-tile-title h2 a",
  DESCRIPTION: '.job-tile-description, [data-test="job-description"], .up-line-clamp-v3, .air3-line-clamp-3',
  JOB_TYPE: '[data-test="job-type"], .job-tile-info-list li:first-child, .air3-display-inline-block',
  CLIENT_LOCATION: '[data-test="client-country"], .job-tile-location, [data-test="location"]',
  CLIENT_PAYMENT: '[data-test="payment-verified"], .payment-verified, .up-icon-verified-check, [data-test="payment-status"]',
  CLIENT_SPEND: '[data-test="client-spend"], .client-spend, span[data-test="total-spent"], .air3-icon-spend',
  CLIENT_HIRE_RATE: '[data-test="client-hire-rate"], .client-hire-rate, .air3-icon-hire-rate',
  JOB_SKILLS: '.up-skill-badge, [data-test="skill"], [data-test="token"], .job-tile-skill, .air3-token, .air3-btn-tag',
  
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
    // Every signal that moves the score is recorded as a contribution so the UI
    // can show an honest "why this score" breakdown instead of a black-box number.
    const contributions = [];
    let score = 35; // Base confidence score
    contributions.push({ label: 'Base score', delta: 35, reason: 'Starting confidence baseline' });

    const add = (delta, label, reason) => {
      score += delta;
      contributions.push({ label, delta, reason });
    };
    // Records a 0-delta note (shown as context, not scored).
    const note = (label, reason) => contributions.push({ label, delta: 0, reason });

    // 1. Critical Filter: Payment Verification (Core Trust)
    if (!jobData.paymentVerified) {
      add(-20, 'Payment unverified', 'No verified billing method — professionals avoid these');
    } else {
      add(10, 'Payment verified', 'Client billing method confirmed');
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
    const skillDelta = Math.min(matchRatio * 40, 40);
    if (matchCount > 0) {
      add(skillDelta, `Skills aligned (${matchCount})`, `Matched: ${Array.from(uniqueMatches).slice(0, 6).join(', ')}`);
    } else if (profileKeywords.length > 0) {
      note('No skill overlap', 'None of your expertise keywords appear here');
    } else {
      note('Profile not synced', 'Sync your Upwork profile to enable skill matching');
    }

    // 2b. Mandatory Skill Lockdown
    if (jobData.mandatorySkills && jobData.mandatorySkills.length > 0) {
        const missingMandatory = jobData.mandatorySkills.filter(s =>
            !profileKeywords.some(p => p.includes(s.toLowerCase()) || s.toLowerCase().includes(p))
        );
        if (missingMandatory.length > 0) {
            add(missingMandatory.length * -15, `Missing mandatory skill${missingMandatory.length > 1 ? 's' : ''}`, `Client requires: ${missingMandatory.join(', ')}`);
        }
    }

    // 3. Financial Alignment (+15%)
    if (jobData.type === 'Hourly') {
      if (jobData.rateMin >= this.settings.hourlyRateMin && jobData.rateMax <= this.settings.hourlyRateMax) {
        add(15, 'Rate in target band', `$${jobData.rateMin}-$${jobData.rateMax}/hr fits your range`);
      } else if (jobData.rateMax < this.settings.hourlyRateMin && jobData.rateMax > 0) {
        add(-15, 'Underpriced', `Max $${jobData.rateMax}/hr is below your $${this.settings.hourlyRateMin}/hr floor`);
      } else if (jobData.rateMin >= this.settings.hourlyRateMin) {
        add(10, 'Meets rate floor', `Starts at $${jobData.rateMin}/hr`);
      }
    } else if (jobData.type === 'Fixed-price') {
      if (jobData.budget >= this.settings.budgetMin) {
        add(15, 'Budget meets minimum', `$${jobData.budget} ≥ your $${this.settings.budgetMin} floor`);
      } else if (jobData.budget > 0 && jobData.budget < this.settings.budgetMin * 0.4) {
        add(-10, 'Budget too low', `$${jobData.budget} is far below your $${this.settings.budgetMin} minimum`);
      }
    }

    // 4. Client Maturity & Hire Rate (+15%)
    if (jobData.clientSpend.toLowerCase().includes('k') || jobData.clientSpend.toLowerCase().includes('m')) {
      add(7, 'Proven spender', `Client has spent ${jobData.clientSpend}`);
    }
    if (jobData.hireRate > 75) {
      add(8, 'High hire rate', `${jobData.hireRate}% of posts lead to a hire`);
    } else if (jobData.hireRate < 30 && jobData.hireRate > 0) {
      add(-10, 'Low hire rate', `Only ${jobData.hireRate}% of posts lead to a hire — likely time-waster`);
    }

    // 5. Geolocation Match (+10%)
    const userLocs = this.settings.locations || [];
    const locationMatched = userLocs.length > 0 && userLocs.some(loc =>
        jobData.location.toLowerCase().includes(loc.toLowerCase())
    );
    if (locationMatched) {
      add(10, 'Preferred region', `Client in your preferred region (${jobData.location})`);
    }

    // 6. Red Flags (Auto-Penalty)
    const blacklist = this.settings.blacklistedLocations || [];
    const isBlacklisted = blacklist.some(loc =>
        jobData.location.toLowerCase().includes(loc.toLowerCase())
    );
    if (isBlacklisted) add(-30, 'Blacklisted region', `${jobData.location} is on your blacklist`);

    if (jobData.proposals === '50+') add(-25, 'Saturated (50+ proposals)', 'You would be bidding against 50+ others');
    else if (jobData.proposals === '20 to 50') add(-10, 'Competitive (20-50 proposals)', 'Crowded proposal pool');

    // 7. Success Multiplier (Freelancer Mention & History)
    if (jobData.freelancerMentioned) {
      add(20, 'Prior collaboration signal', 'Client history references a profile like yours');
    }

    // Recency Momentum
    const recency = this.calculateRecencyAlpha(jobData.lastViewed);
    if (recency > 0) add(recency, 'Active client', `Recently active (${jobData.lastViewed})`);
    else if (recency < 0) add(recency, 'Stale intent', `Not viewed recently (${jobData.lastViewed})`);

    // Ghost Detection (Unanswered Invites Penalty)
    if (parseInt(jobData.unanswered) > 10 && parseInt(jobData.interviewing) === 0) {
        add(-20, 'Possible ghost job', `${jobData.unanswered} unanswered invites, 0 interviews`);
    }

    // 8. Deep Intelligence Boosts (God View)
    if (jobData.avgRating && parseFloat(jobData.avgRating) >= 4.5) add(5, 'Well-rated client', `${jobData.avgRating}★ average rating`);
    if (jobData.avgRatePaid) {
      const avgPaid = parseFloat(jobData.avgRatePaid.replace(/[^0-9.]/g, ''));
      if (avgPaid >= this.settings.hourlyRateMin) add(10, 'Pays well historically', `Avg paid ${jobData.avgRatePaid}/hr`);
    }

    const finalScore = Math.max(0, Math.min(Math.round(score), 100));

    // Calculate precise skills gap
    const missingMandatory = (jobData.mandatorySkills || []).filter(s =>
        !profileKeywords.some(p => p.includes(s.toLowerCase()) || s.toLowerCase().includes(p))
    );

    return {
      total: finalScore,
      matches: Array.from(uniqueMatches),
      missingMandatory,
      locationMatched,
      isBlacklisted,
      highCompetition: jobData.proposals === '50+',
      freelancerMentioned: jobData.freelancerMentioned,
      paymentVerified: jobData.paymentVerified,
      recencyAlpha: recency,
      contributions,
      advice: this.generateAlphaAdvice(finalScore, jobData, locationMatched, Array.from(uniqueMatches))
    };
  }

  calculateRecencyAlpha(lastViewed) {
    if (!lastViewed) return 0;
    const lower = lastViewed.toLowerCase();
    if (lower.includes('minute') || lower.includes('moment')) return 15; // Active NOW
    if (lower.includes('hour') && parseInt(lower) < 6) return 10; // Active recently
    if (lower.includes('day') || lower.includes('week')) return -10; // Stale job
    return 0;
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

    if (jobData.lastViewed && (jobData.lastViewed.includes('day') || jobData.lastViewed.includes('week'))) {
        message = "⚠️ STALE INTENT: Client hasn't viewed this in 24h+. Proceed with caution.";
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
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    log('Initializing Engine...');
    try {
        const data = await chrome.storage.sync.get('settings');
        if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
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
          document.querySelectorAll(SELECTORS.JOB_TILE).forEach(tile => {
              delete tile.dataset.matchProcessed;
          });
          this.runCycle();
        }
      } catch (e) {
        log('Context lost in storage listener');
      }
    });

    // Keyboard Shortcut: Ctrl+Alt+M toggles the visibility of injected panels
    // (purely a local UI convenience — does not change Upwork or hide activity).
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
            document.body.classList.toggle('mi-hide-panels');
            const isHidden = document.body.classList.contains('mi-hide-panels');
            log(`Panels hidden: ${isHidden ? 'ON' : 'OFF'}`);
        }
    });
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
  }

  // Parses the details of a job from a modal/panel the user has opened on the
  // page they are viewing. No background page fetching is performed.
  parseIntelFromHtml(html) {
    if (!html) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const fullText = doc.body.innerText;

    // 1. Client Name (Deep Recursive Heuristic Scanning)
    let clientName = null;
    const feedbacks = doc.querySelectorAll('.up-review-content p, .air3-review-content p, .up-review-content');
    const namePatterns = [
        /(?:hi|thanks|thank you|with|to|for|was|to|appreciated|great|pleasure)\s+([A-Z][a-z]+)/i,
        /([A-Z][a-z]+)\s+(?:was|did|is|has|been|helped)/
    ];
    
    for (const fb of feedbacks) {
        const text = fb.textContent;
        for (const pattern of namePatterns) {
            const nameMatch = text.match(pattern);
            if (nameMatch && !['upwork', 'client', 'the', 'project', 'he', 'she', 'him', 'her', 'this', 'team', 'highly', 'very', 'work', 'freelancer', 'to', 'for'].includes(nameMatch[1].toLowerCase())) { 
                clientName = nameMatch[1]; 
                break; 
            }
        }
        if (clientName) break;
    }

    // 1b. Deep Name Extraction from Work History
    if (!clientName) {
        const historyItems = doc.querySelectorAll('.ca-item, .item');
        for (const item of historyItems) {
            const feedbackText = item.innerText;
            const match = feedbackText.match(/(?:thanks|thank you|great|working with|pleasure|was|to)\s+([A-Z][a-z]{2,15})/i);
            if (match && !['upwork', 'client', 'the', 'project', 'he', 'she', 'him', 'her', 'this', 'team', 'highly', 'very', 'work', 'freelancer'].includes(match[1].toLowerCase())) {
                clientName = match[1];
                break;
            }
        }
    }

    // 2. Client Stats (Deep State Extraction + Heuristic Regex)
    const activity = { interview: 0, invites: 0, proposals: '0', lastViewed: null, unanswered: 0 };
    
    // Tier 1: Data-QA Selectors (Air3 Layout Robustness)
    const qaStats = doc.querySelector('[data-qa="client-job-posting-stats"]');
    const qaSpend = doc.querySelector('[data-qa="client-spend"]');
    const qaRate = doc.querySelector('[data-qa="client-hourly-rate"]');
    const qaHires = doc.querySelector('[data-qa="client-hires"]');
    const qaHours = doc.querySelector('[data-qa="client-hours"]');
    const qaMember = doc.querySelector('[data-qa="client-contract-date"]');
    const qaLocation = doc.querySelector('[data-qa="client-location"]');

    let jobsPosted = qaStats?.querySelector('strong')?.innerText.match(/\d+/)?.[0];
    let hireRateValue = qaStats?.querySelector('div')?.innerText.match(/(\d+)%/)?.[1];
    let totalSpentValue = qaSpend?.innerText.match(/\$([0-9KkMm+.,]+)/)?.[1];
    let avgRateValue = qaRate?.innerText.match(/\$([0-9.]+)/)?.[1];
    let totalHires = qaHires?.innerText.match(/(\d+)\s+hires?/i)?.[1];
    let activeHires = qaHires?.innerText.match(/(\d+)\s+active/i)?.[1];
    let totalHours = qaHours?.innerText.match(/([0-9,]+)\s+hours?/i)?.[1];
    let memberSinceValue = qaMember?.innerText.match(/Member since (.+)/i)?.[1];
    let locationValue = qaLocation?.querySelector('strong')?.innerText.trim();

    // Backfill from the rendered text of the opened panel only.
    if (!hireRateValue) hireRateValue = (html.match(/(\d+)%\s*hire rate/i)?.[1]);
    if (!totalSpentValue) totalSpentValue = (html.match(/\$([0-9KkMm+.,]+)\s+total spent/i)?.[1]);
    if (!avgRateValue) avgRateValue = (html.match(/\$([0-9.]+)\s+\/hr\s+avg hourly rate paid/i)?.[1]);

    const hireRateMatch = html.match(/(\d+)%\s*(?:hire rate|hire)/i) || html.match(/hire rate:\s*(\d+)%/i);
    const spendMatch = html.match(/\$([0-9KkMm+.,]+)(?:\+)?\s+(?:total spent|spent)/i) || html.match(/spent:\s*\$([0-9KkMm+.,]+)/i);
    const avgRateMatch = html.match(/\$([0-9.]+)\s+\/hr\s+avg hourly rate paid/i) || html.match(/avg hourly rate paid:\s*\$([0-9.]+)/i);
    const ratingMatch = html.match(/Rating is ([0-9.]+)/i) || html.match(/([45]\.[0-9])\s+of\s+5\s+stars/i) || html.match(/([\d\.]+)\s+Rating/i);
    const memberSinceMatch = html.match(/Member since ([A-Z][a-z]+ \d+, \d+)/i) || html.match(/Joined\s+([A-Z][a-z]+ \d+, \d+)/i);
    
    const jobsPostedMatch = html.match(/(\d+)\s+jobs posted/i);
    const hiresMatch = html.match(/(\d+)\s+hires/i);
    const activeMatch = html.match(/(\d+)\s+active/i);
    const hoursMatch = html.match(/(\d+,?\d*)\s+hours/i);

    // 3. Location Extraction
    let location = null;
    const locMatch = html.match(/([A-Z][A-Za-z\s,]+)\d{1,2}:\d{2}\s+(?:AM|PM)/);
    if (locMatch) location = locMatch[1].trim().replace(/\s+$/, '');

    // 4. Activity Momentum Logic (Tier 1: List Selectors)
    const activityItems = doc.querySelectorAll('.client-activity-items .ca-item');
    activityItems.forEach(item => {
        const title = item.querySelector('.title')?.innerText.toLowerCase() || '';
        const value = item.querySelector('.value')?.innerText.trim() || '';
        if (title.includes('interviewing')) activity.interview = parseInt(value) || 0;
        else if (title.includes('invites sent')) activity.invites = parseInt(value) || 0;
        else if (title.includes('unanswered')) activity.unanswered = parseInt(value) || 0;
        else if (title.includes('proposals')) activity.proposals = value;
        else if (title.includes('last viewed')) activity.lastViewed = value;
    });

    // Fallback: Regex Search
    if (activity.interview === 0) {
        const intMatch = fullText.match(/Interviewing:\s*(\d+)/i);
        if (intMatch) activity.interview = parseInt(intMatch[1]);
    }
    if (activity.invites === 0) {
        const invMatch = fullText.match(/Invites sent:\s*(\d+)/i);
        if (invMatch) activity.invites = parseInt(invMatch[1]);
    }
    if (!activity.lastViewed) {
        const viewMatch = fullText.match(/Last viewed by client:\s*([^\n]+)/i);
        if (viewMatch) activity.lastViewed = viewMatch[1].trim();
    }
    
    // 4b. Connects Extraction
    const connectsMatch = fullText.match(/Send a proposal for:\s*(\d+)/i) || html.match(/Send a proposal for:\s*<strong>(\d+)<\/strong>/i);
    const availableMatch = fullText.match(/Available Connects:\s*(\d+)/i) || html.match(/Available Connects:\s*<strong>(\d+)<\/strong>/i);
    
    const hireMatch = fullText.match(/(\d+)%\s*hire rate/i) || html.match(/(\d+)%\s*hire rate/i);

    // 5. Mandatory Skills Extraction
    const mandatorySkills = [];
    const mandatorySection = doc.querySelector('[data-test="mandatory-skills-section"], .air3-token-container');
    if (mandatorySection) {
        mandatorySection.querySelectorAll('.air3-token').forEach(t => mandatorySkills.push(t.innerText.trim()));
    }

    return {
        clientName,
        location: locationValue || location,
        mandatorySkills,
        hireRate: (hireRateValue !== undefined && hireRateValue !== null && hireRateValue !== "") ? parseInt(hireRateValue) : (hireMatch ? parseInt(hireMatch[1]) : (hireRateMatch ? parseInt(hireRateMatch[1]) : null)),
        clientSpend: (totalSpentValue !== undefined && totalSpentValue !== null) ? (totalSpentValue.toString().includes('$') ? totalSpentValue : "$" + totalSpentValue) : (spendMatch ? "$" + spendMatch[1] : null),
        avgRatePaid: (avgRateValue !== undefined && avgRateValue !== null) ? "$" + avgRateValue : (avgRateMatch ? "$" + avgRateMatch[1] : null),
        avgRating: ratingMatch ? ratingMatch[1] : null,
        memberSince: memberSinceValue || (memberSinceMatch ? memberSinceMatch[ memberSinceMatch.length - 1 ] : null),
        jobsPosted: jobsPosted || (jobsPostedMatch ? jobsPostedMatch[1] : null),
        totalHires: totalHires || (hiresMatch ? hiresMatch[1] : null),
        activeHires: activeHires || (activeMatch ? activeMatch[1] : null),
        totalHours: totalHours || (hoursMatch ? hoursMatch[1] : null),
        paymentVerified: html.includes('Payment method verified'),
        connectsRequired: connectsMatch ? connectsMatch[1] : null,
        availableConnects: availableMatch ? availableMatch[1] : null,
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
    if (intel.clientName) tile.dataset.clientName = intel.clientName;
    else delete tile.dataset.clientName;

    tile.dataset.interviewing = intel.activity?.interview || '0';
    tile.dataset.invites = intel.activity?.invites || '0';
    tile.dataset.lastViewed = intel.activity?.lastViewed || '';
    tile.dataset.unanswered = intel.activity?.unanswered || '0';
    tile.dataset.mandatorySkills = (intel.mandatorySkills || []).join(',');
    tile.dataset.avgRatePaid = intel.avgRatePaid || '';
    tile.dataset.avgRating = intel.avgRating || '';
    tile.dataset.memberSince = intel.memberSince || '';
    tile.dataset.jobsPosted = intel.jobsPosted || '';
    tile.dataset.totalHires = intel.totalHires || '';
    tile.dataset.activeHires = intel.activeHires || '';
    tile.dataset.totalHours = intel.totalHours || '';
    if (intel.connectsRequired) tile.dataset.connectsRequired = intel.connectsRequired;
    if (intel.paymentVerified) tile.dataset.paymentVerifiedBackfill = 'true';
    if (intel.location) tile.dataset.locationBackfill = intel.location;
    if (intel.hireRate !== null) tile.dataset.hireRateBackfill = intel.hireRate;
    if (intel.clientSpend !== null) tile.dataset.spendBackfill = intel.clientSpend;
    
    tile.dataset.matchProcessed = 'true'; 
    tile.querySelectorAll('.match-intelligence-badge').forEach(b => b.remove());
    
    const jobData = this.extractJobData(tile);
    const result = this.scorer.calculateScore(jobData);
    this.injectBadge(tile, result, jobData);
  }

  detectAndSaveProfileFromNav() {
    const profileLink = document.querySelector(SELECTORS.NAV_PROFILE_LINK);
    if (profileLink?.href) {
      this.saveDetectedProfileUrl(profileLink.href.split('?')[0]);
    }
  }

  async saveDetectedProfileUrl(url) {
    if (!chrome.runtime?.id) return;
    if (this._lastSavedUrl === url) return; // Immediate memory-cache bypass 
    
    try {
        const { settings = {} } = await chrome.storage.sync.get('settings');
        if (!chrome.runtime?.id) return;
        
        if (settings.myProfileUrl !== url) {
          log('Saving detected profile URL:', url);
          this._lastSavedUrl = url;
          await chrome.storage.sync.set({ settings: { ...settings, myProfileUrl: url } });
        } else {
          this._lastSavedUrl = url;
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

    // Fail loudly rather than silently saving an empty Expertise Matrix when
    // Upwork's profile layout has shifted and our selectors matched nothing.
    if (!profileName && rate === 0 && skills.length === 0 && !title) {
      if (btn) {
        btn.innerHTML = "⚠️ Couldn't read profile — Upwork layout may have changed";
        btn.style.background = '#dc2626';
        setTimeout(() => {
          btn.innerHTML = '⚡ Sync MY Intelligence';
          btn.style.background = '';
        }, 4000);
      }
      log('syncProfile aborted: no profile data extracted');
      return;
    }

    const keywordPool = new Set([...skills, ...title.split(' ').filter(w => w.length > 3)]);

    try {
        const { settings = {} } = await chrome.storage.sync.get('settings');
        if (!chrome.runtime?.id) return;
        
        // Populate the 'Skill Vectors & Filter / Expertise Matrix' in the popup settings
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
    jobTiles.forEach(async (tile) => {
      if (tile.dataset.matchProcessed === 'true') return;
      
      const link = tile.querySelector(SELECTORS.TITLE)?.href;
      if (!link) return;
      const jobIdMatch = link.match(/~[0-9a-f]+/i);
      if (jobIdMatch) {
          const jobId = jobIdMatch[0];
          // Check if we have deep intel in cache
          try {
              if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
              const { deepIntel = {} } = await chrome.storage.local.get('deepIntel');
              if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
              if (deepIntel[jobId]) {
                  this.applyDeepIntelToTile(tile, deepIntel[jobId]);
                  return;
              }
          } catch(e) {}
      }

      const jobData = this.extractJobData(tile);
      if (jobData.title && jobData.title !== "Untitled Job") {
        const result = this.scorer.calculateScore(jobData);
        this.injectBadge(tile, result, jobData);
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
    let hireRate = tile.dataset.hireRateBackfill ? parseInt(tile.dataset.hireRateBackfill) : null;
    const fullText = tile.innerText;
    
    // Payment Verification check
    const paymentVerified = !!paymentEl || fullText.toLowerCase().includes('payment verified') || tile.dataset.paymentVerifiedBackfill === 'true';

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
      jobsPosted: tile.dataset.jobsPosted || null,
      totalHires: tile.dataset.totalHires || null,
      activeHires: tile.dataset.activeHires || null,
      totalHours: tile.dataset.totalHours || null,
      memberSince: tile.dataset.memberSince || null,
      connectsRequired: tile.dataset.connectsRequired || null,
      interviewing: tile.dataset.interviewing || 0,
      invites: tile.dataset.invites || 0,
      lastViewed: tile.dataset.lastViewed || null,
      unanswered: tile.dataset.unanswered || 0,
      mandatorySkills: tile.dataset.mandatorySkills ? tile.dataset.mandatorySkills.split(',') : [],
      freelancerMentioned: tile.dataset.clientName ? true : false,
      jobSkills: Array.from(skillsEls).map(el => el.textContent.trim())
    };
  }

  injectBadge(tile, result, jobData) {
    const score = result.total;
    const matches = result.matches || [];
    const badge = document.createElement('div');
    badge.className = 'match-intelligence-badge premium';

    let color = '#ef4444';
    if (score >= 60) color = '#f59e0b';
    if (score >= 80) color = '#10b981';

    // "Don't waste Connects" warning — surfaced when concrete red flags exist.
    const skipReasons = this.buildSkipReasons(result, jobData);
    const hardBlocker = !jobData.paymentVerified || (result.missingMandatory && result.missingMandatory.length > 0) || result.isBlacklisted;
    const skipHtml = (skipReasons.length > 0 && (score < 65 || hardBlocker)) ? `
          <div class="mi-skip-warning">
            <span class="mi-skip-title">⚠️ Likely Connect-waster — verify before bidding</span>
            <ul class="mi-skip-list">${skipReasons.map(r => `<li>${r}</li>`).join('')}</ul>
          </div>` : '';

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
          <div class="mi-strategic-verdict">
             <div class="mi-verdict-label" style="background: ${color}">${this.getVerdictTitle(score)}</div>
             <div class="mi-verdict-message">${result.advice.message}</div>
          </div>
          ${skipHtml}

          <div class="mi-dossier-grid">
            ${this.scorer.settings.profileSummary?.title ? `
            <div class="mi-dossier-item">
                <span class="label">COMPETENCY ANCHOR</span>
                <span class="value">${this.scorer.settings.profileSummary.title.toUpperCase()}</span>
            </div>` : ''}

            <div class="mi-dossier-item">
                <span class="label">SKILLS ALIGNMENT</span>
                <span class="value">${result.matches.length > 0 ? `MATCHED: ${result.matches.slice(0,3).join(', ')}` : (this.scorer.settings.keywords?.length > 0 ? 'NO OVERLAP' : 'SYNC PROFILE...')}</span>
            </div>

            <div class="mi-dossier-item">
                <span class="label">COMPETITION HEAT</span>
                <span class="value">${this.getCompetitionHeat(jobData)}</span>
            </div>

            ${jobData.lastViewed ? `
            <div class="mi-dossier-item">
                <span class="label">RECENCY</span>
                <span class="value">👀 ${jobData.lastViewed.toUpperCase()}</span>
            </div>` : jobData.memberSince ? `
            <div class="mi-dossier-item">
                <span class="label">SINCE</span>
                <span class="value">${jobData.memberSince.toUpperCase()}</span>
            </div>` : ''}

            ${result.missingMandatory && result.missingMandatory.length > 0 ? `
            <div class="mi-dossier-item full-width" style="color: #be123c; border-top: 1px dashed #fecaca; margin-top: 5px; padding-top: 5px;">
                <span class="label" style="color: #e11d48;">⚠️ MISSING MANDATORY SKILLS</span>
                <span class="value">${result.missingMandatory.join(' • ')}</span>
            </div>` : ''}

            ${this.hasClientDossier(jobData) ? `
            <div class="mi-dossier-item full-width">
                <span class="label">CLIENT HISTORY & TRUST DOSSIER</span>
                <span class="value">${tile.dataset.clientName ? `[${tile.dataset.clientName}] • ` : ''}${this.getClientDossierLine(jobData)}</span>
            </div>` : ''}
          </div>

          ${this.buildBreakdownHtml(result.contributions)}

          <div class="mi-intel-footer" style="${(result.matches.length === 0 && !jobData.connectsRequired) ? 'display:none' : ''}">
            <div class="mi-detail-chips">
                 ${jobData.connectsRequired ? `<span class="mi-chip gold">${jobData.connectsRequired} CONNECTS</span>` : ''}
                 ${jobData.avgRating ? `<span class="mi-chip">⭐ ${jobData.avgRating}</span>` : ''}
                 ${(jobData.hireRate !== null && jobData.hireRate > 0) ? `<span class="mi-chip ${jobData.hireRate < 30 ? 'pulse red' : ''}">${jobData.hireRate}% HIRE</span>` : ''}
                 ${jobData.invites > 0 ? `<span class="mi-chip gold pulse">📩 ${jobData.invites} INVITES</span>` : ''}
                 ${jobData.interviewing > 0 ? `<span class="mi-chip pulse">🔥 ${jobData.interviewing} INTERVIEWING</span>` : ''}
            </div>
          </div>
        </div>

        <div class="mi-actions-container">
            ${score >= (this.scorer.settings.minScoreToNotify || 85) ? `
            <button class="mi-ai-action" title="AI Deep Dive (Alpha Analysis)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
            </button>` : ''}
            <button class="mi-save-action" title="Track Opportunity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </button>
        </div>
      </div>
    `;

    // SAFELY ATTACH EVENT LISTENERS
    const saveBtn = badge.querySelector('.mi-save-action');
    if (saveBtn) {
        saveBtn.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          this.saveJob(jobData, result);
          e.currentTarget.style.color = '#10b981';
          e.currentTarget.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17L4 12"/></svg>';
        };
    }

    const aiBtn = badge.querySelector('.mi-ai-action');
    if (aiBtn) {
        aiBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            this.triggerAIInsight(tile, jobData);
        };
    }

    tile.prepend(badge);
    const threshold = this.scorer.settings.minScoreToNotify || 85;
    if (score >= threshold) tile.classList.add('mi-high-match-v2');
  }

  async saveJob(jobData, result = {}) {
    if (!chrome.runtime?.id) return;
    try {
        const { savedJobs = [] } = await chrome.storage.local.get("savedJobs");
        if (chrome.runtime?.id && !savedJobs.some((j) => j.link === jobData.link)) {
            savedJobs.push({
              ...jobData,
              score: (result.total !== undefined ? result.total : null),
              verdict: (result.total !== undefined ? this.getVerdictTitle(result.total) : null),
              contributions: result.contributions || [],
              advice: result.advice?.message || null,
              savedAt: new Date().toISOString()
            });
            await chrome.storage.local.set({ savedJobs });
        }
    } catch (e) {
        log('Context lost in saveJob');
    }
  }

  // Concrete reasons a job is likely to waste Connects — drives the inline
  // "verify before bidding" warning and keeps the tool honest about junk.
  buildSkipReasons(result, jobData) {
    const reasons = [];
    if (!jobData.paymentVerified) reasons.push('Payment method unverified');
    if (jobData.hireRate !== null && jobData.hireRate < 30 && jobData.hireRate > 0) reasons.push(`Low hire rate (${jobData.hireRate}%)`);
    if (jobData.proposals === '50+') reasons.push('Over-saturated (50+ proposals)');
    if (result.missingMandatory && result.missingMandatory.length > 0) reasons.push(`Missing required skills: ${result.missingMandatory.join(', ')}`);
    if (parseInt(jobData.unanswered) > 10 && parseInt(jobData.interviewing) === 0) reasons.push('Possible ghost job (unanswered invites)');
    if (result.isBlacklisted) reasons.push('Blacklisted region');
    return reasons;
  }

  // Collapsible, signed "why this score" list, sorted by impact.
  buildBreakdownHtml(contributions) {
    const items = (contributions || []).filter(c => c.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    if (items.length === 0) return '';
    const rows = items.map(c => {
      const pos = c.delta > 0;
      return `<div class="mi-bd-row">
          <span class="mi-bd-delta ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${Math.round(c.delta)}</span>
          <span class="mi-bd-text"><strong>${c.label}</strong><span class="mi-bd-reason">${c.reason}</span></span>
        </div>`;
    }).join('');
    return `<details class="mi-breakdown"><summary>Why this score?</summary><div class="mi-bd-body">${rows}</div></details>`;
  }

  getVerdictTitle(score) {
      if (score >= 85) return '🔥 PRIME';
      if (score >= 65) return '⚖️ NEUTRAL';
      if (score >= 45) return '⚠️ FRICTION';
      return '📉 SKIP';
  }

  getCompetitionHeat(jobData) {
      const interview = parseInt(jobData.interviewing || 0);
      const proposals = jobData.proposals || "0";
      
      if (interview >= 5) return '🔥 ACTIVE RACE';
      if (proposals.includes('50+')) return '⚠️ SATURATED';
      if (proposals.includes('20') || proposals.includes('15')) return '⚖️ COMPETITIVE';
      if (proposals.includes('5') || proposals.includes('Less than 5')) return '💎 LOW FRICTION';
      return 'NEW OPPORTUNITY';
  }

  // Notify once per job, and remember it across page reloads/sessions so the
  // same job never re-alerts. Entries older than 7 days are pruned.
  async notifyHighMatch(jobData, score) {
    if (!chrome.runtime?.id) return;
    if (!jobData.link) return;
    if (this.processedJobs.has(jobData.link)) return;
    this.processedJobs.add(jobData.link);
    try {
      const WEEK = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const { notifiedJobs = {} } = await chrome.storage.local.get('notifiedJobs');
      for (const k of Object.keys(notifiedJobs)) {
        if (now - notifiedJobs[k] > WEEK) delete notifiedJobs[k];
      }
      if (notifiedJobs[jobData.link]) return; // Already alerted within the window
      notifiedJobs[jobData.link] = now;
      if (!chrome.runtime?.id) return;
      await chrome.storage.local.set({ notifiedJobs });
      chrome.runtime.sendMessage({ type: "NOTIFY_HIGH_MATCH", jobData, score });
    } catch (e) {
      log('Context lost in notifyHighMatch');
    }
  }

  hasClientDossier(jobData) {
      return jobData.jobsPosted || jobData.totalHires || jobData.totalHours || jobData.avgRatePaid;
  }

  getClientDossierLine(jobData) {
      const parts = [];
      if (jobData.jobsPosted && jobData.jobsPosted !== '0') parts.push(`${jobData.jobsPosted} POSTS`);
      if (jobData.totalHires && jobData.totalHires !== '0') parts.push(`${jobData.totalHires} HIRES`);
      if (jobData.activeHires && jobData.activeHires !== '0') parts.push(`${jobData.activeHires} ACTIVE`);
      if (jobData.totalHours && jobData.totalHours !== '0') parts.push(`${jobData.totalHours}HRS`);
      
      return parts.length > 0 ? parts.join(' • ') : 'NEW CLIENT';
  }

  async triggerAIInsight(tile, jobData) {
      const btn = tile.querySelector('.mi-ai-action');
      const alphaSidebar = tile.querySelector('.mi-panel-sidebar');
      const scoreCircle = tile.querySelector('.mi-score-circle');
      const adviceStrip = tile.querySelector('.mi-verdict-message');

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
