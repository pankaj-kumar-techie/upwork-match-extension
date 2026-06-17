# Upwork Match Intelligence (UMI) ⚡

UMI is a **local reading aid** for senior freelancers. It scores the jobs on the feed page you are already viewing, performs skills-gap analysis, and (optionally) provides strategic AI insights — all client-side, on the page in front of you.

> **Compliance note:** UMI only reads what is rendered on the page you are actively browsing. It does **not** crawl or background-fetch job pages, does not auto-refresh the feed, and does not auto-perform any action on your behalf. This keeps it within normal browser-extension usage and avoids automated-scraping behavior that platforms prohibit. Always review Upwork's Terms of Service for your own account.

## 🚀 Key Problems Solved

1.  **Activity at a glance**: When you open a job's detail panel, UMI reads the visible "Activity on this job" (interviews, invites, last viewed) and folds it into the score for that card.
2.  **Skills Blindness**: Instantly see matching keywords and **Missing Mandatory Skills** before investing connects.
3.  **Low-Yield Filtering**: Automatically penalizes jobs with unverified payments or low hire rates (<30%).
4.  **Market Saturation**: The "Saturation Shield" de-prioritizes jobs with 50+ proposals.
5.  **Strategic Bidding**: AI-generated "Pitch Hooks" and "Winning Strategies" for high-alpha opportunities.

## 🧠 Core Intelligence Modules

### 1. Zero-Config Profile Sync

UMI is "Smart from Day 1". Visit your [Upwork Profile](https://www.upwork.com/freelancers/~) once, and the extension will auto-sync your skills, title, and rate into the **Expertise Matrix**. This pool is used to calculate all matches and guide the AI.

### 2. The Alpha Score (0-100)

A multi-layered heuristic engine that weighs Trust, Competency, and Opportunity Heat.

- **PRIME (>85)**: High alignment, low friction.
- **NEUTRAL (65-85)**: Solid but requires review.
- **FRICTION (<45)**: Stale intent, saturated market, or skill mismatch.

### 3. AI Deep Dive (Alpha Insight)

When you find a High-Alpha Opportunity, trigger the **Deep Dive**. UMI sends job telemetry to your LLM (Gemini/OpenAI) to generate a tactical pitch hook and a revised "Cognitive Score".

## 🛠️ Setup & Best Practices

1.  **Install**: Load the `upwork-match-extension` folder as an unpacked extension in Chrome.
2.  **Calibrate**: Open the extension popup, set your Target Rates and Budget Minimums.
3.  **Sync Profile**: visit your Upwork Profile. Click **"⚡ Sync MY Intelligence"**. This populates your **Expertise Matrix**.
4.  **LLM Setup**: (Optional) Add your Gemini or OpenAI API Key in the popup Settings tab to enable the **Deep Dive** feature.
5.  **Deploy**: Navigate to "Most Recent" or "My Feed" on Upwork. Cards are scored as they render. When a job meets your **Notify Threshold**, you get a desktop alert so you can target it. Click the bookmark icon on any card to save it to your Tracker, and open a job's detail panel to enrich its score with client activity.

## 🔍 Manual Testing & Verification

To confirm the extension is functioning correctly:

- **Badge Injection**: Badges should appear on every job card with an `ALPHA` score.
- **Sync Check**: After syncing your profile, open the popup and verify the "Skill Vectors" textarea is populated with your skills.
- **AI Verification**: Click the circle icon on a high-score job. If configured correctly, it will show "Consultant is analyzing..." and then reveal a "Winning Strategy".

---

_MNC-Grade Proposal Engineering for High-Performance Talent._
