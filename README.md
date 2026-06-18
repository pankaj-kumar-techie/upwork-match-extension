# Upwork Match Intelligence (UMI) ⚡

**The private, honest second opinion that stops you wasting Connects on bad jobs.**

UMI is a **local reading aid** for senior freelancers. It scores the jobs on the feed page you are
already viewing, performs skills-gap analysis, tells you *why* it scored each job that way, and
(optionally) provides strategic AI insights — all client-side, on the page in front of you.

- **Type:** Chrome (Manifest V3) browser extension
- **Version:** 1.1.0
- **Runs on:** `https://www.upwork.com/*`
- **Backend:** none — there is no UMI server

---

## Why UMI is different

Most Upwork tools race to alert you on *more* jobs, faster — and to do it they run on a server that
ingests your job-search data and, in some cases, your account. UMI takes the opposite stance:

- 🔒 **Privacy-first.** Everything runs in your browser. There is no UMI server. Your settings live in
  `chrome.storage`; your AI API key is stored **locally on your device** (`chrome.storage.local`) and is
  never cloud-synced — it is only ever sent to the AI provider *you* choose.
- 🧠 **Honest, explainable scoring.** Every score ships with a **"Why this score?"** breakdown (each
  signal, signed, with a reason) and a prominent **"⚠️ Likely Connect-waster"** warning when a job has
  real red flags. UMI is built to talk you *out* of junk, not into bidding on everything.
- ✅ **ToS-safe by design.** UMI only reads what is rendered on the page you are actively browsing. It
  does **not** crawl or background-fetch job pages, does **not** auto-refresh the feed, and **never**
  auto-submits proposals or performs any action on your behalf. You review and send every proposal.

> **Compliance note:** This keeps UMI within normal browser-extension usage and avoids the
> automated-scraping and auto-apply behavior Upwork's Terms prohibit. Always review Upwork's Terms of
> Service for your own account.

## What this is NOT

UMI is a **bidding assistant**, not a 24/7 unattended job radar — it only scores jobs while you have the
feed open. True hands-off monitoring can't live safely inside a browser extension; see
[`docs/RADAR_ROADMAP.md`](docs/RADAR_ROADMAP.md) for the official-API-based approach that would.

---

## Features

| Feature | What it does |
| :------ | :----------- |
| **Match Score (0–100)** | A heuristic score injected onto every job card as you browse the feed. |
| **"Why this score?" breakdown** | Expandable list of every signal that moved the score, each signed (+/−) with a plain-English reason. |
| **Connect-waster warning** | A prominent skip block listing concrete red flags (unverified payment, <30% hire rate, 50+ proposals, missing required skills, ghost-job signals). |
| **Skills-gap analysis** | Highlights matched keywords and flags **Missing Mandatory Skills** the client explicitly requires. |
| **Profile sync** | One click on your Upwork profile populates your **Expertise Matrix** (skills, title, rate) used for matching. |
| **Activity enrichment** | When you open a job's detail panel, UMI reads the visible "Activity on this job" (interviews, invites, last viewed) and folds it into that card's score. |
| **Desktop notifications** | Optional alert when a job on the page scores at/above your **Notify Threshold**, de-duplicated across reloads (7-day memory). |
| **Optional webhook** | Mirror high-match alerts to Discord or Telegram (title, budget, public link only). |
| **AI Deep Dive (optional)** | Sends the job + your profile summary to *your* Gemini/OpenAI key to produce a revised score, winning strategy, pitch hook, and red flags. |
| **Tracker** | Bookmark jobs to a local tracker that keeps the score, breakdown, and metadata; remove any time. |

## How the score works (short version)

Scoring starts at a **base of 35** and each signal adds or subtracts points. The full, signed breakdown
is visible on every card via **"Why this score?"**. Signals include payment verification, skill/keyword
overlap, missing mandatory skills, rate/budget fit, client spend & hire rate, preferred/blacklisted
region, proposal saturation, prior-collaboration hints, recency, and ghost-job detection.

**Verdict bands:** 🔥 PRIME (≥85) · ⚖️ NEUTRAL (65–84) · ⚠️ FRICTION (45–64) · 📉 SKIP (<45).

Full details and the signal-by-signal table: [`docs/SCORING_LOGIC.md`](docs/SCORING_LOGIC.md).

---

## Install

1. Open Chrome → `chrome://extensions/`.
2. Enable **Developer Mode** (top-right).
3. Click **Load Unpacked** and select this `upwork-match-extension` folder.
4. Pin the **Match Intel** icon for quick access to the popup.

## Setup (5 minutes)

1. **Sync your profile.** Paste your public profile URL (`https://www.upwork.com/freelancers/~…`) into
   the popup, then click **Begin High-Alpha Sync** (or visit your profile and click **⚡ Sync MY
   Intelligence**). This fills your Expertise Matrix.
   - *If the Sync button reports "Couldn't read profile," Upwork's layout shifted — re-open your profile
     and try again.*
2. **Calibrate thresholds.** Set your `$/hr` floor & target, fixed-budget minimum, preferred/blacklisted
   regions, and **Notify Threshold** (default 85).
3. **(Optional) Enable AI.** Pick a model and paste your own API key. The key stays on your device.
4. **Browse.** Open *Find Work → Most Recent* or *My Feed*. Cards are scored as they render. Open a job's
   detail panel to enrich its score with client activity. Bookmark anything worth tracking.

## Settings reference

| Setting | Storage | Notes |
| :------ | :------ | :---- |
| Public Profile URL | sync | Drives profile sync; auto-detected when you visit your own profile. |
| `$/hr` Floor / Target | sync | Hourly rate band used for financial fit. |
| Fixed Budget Minimum | sync | Minimum acceptable fixed-price budget. |
| Expertise Matrix (keywords) | sync | Auto-filled by profile sync; editable. The match engine's source of truth. |
| Preferred Regions / Blacklisted Zones | sync | Bonus for preferred, penalty for blacklisted. |
| Notify Threshold (%) | sync | Desktop alert fires at/above this score. |
| Webhook URL | sync | Optional Discord/Telegram mirror. |
| AI Model | sync | `none` (heuristics only), Gemini, or OpenAI. |
| **AI API Key** | **local** | **Never cloud-synced.** Only sent to your chosen provider. |
| Tracked jobs | local | Saved via the bookmark icon; device-local. |

---

## Privacy & data

- **No backend.** UMI has no server and sends your data to no one — except, if you turn on AI, the job
  text + your profile summary go directly from your browser to the AI provider you configured.
- **Settings** sync via your browser's `chrome.storage.sync` (Google account). **Your API key and saved
  jobs** are kept in `chrome.storage.local` and never leave the device.
- **No scraping / no automation.** UMI reads only the page you're viewing, never auto-refreshes, and
  never acts on Upwork for you.

## Keyboard shortcuts

- **Ctrl + Alt + M** — toggle visibility of all injected UMI panels (local UI only).

## Project structure

```
upwork-match-extension/
├── manifest.json          # MV3 manifest (permissions, scripts)
├── background.js          # Service worker: notifications, webhooks, AI calls
├── content/
│   ├── content.js        # Engine: scrape page → score → inject badges
│   └── content.css       # Injected badge / panel styles
├── popup/
│   ├── popup.html        # Settings + Tracker UI
│   ├── popup.js          # Settings persistence, tracker, validation
│   └── popup.css         # Popup styles
└── docs/                 # Architecture, scoring, AI, testing, roadmap
```

## Documentation

- [Documentation index](docs/index.md)
- [Architecture & design](docs/architecture.md)
- [Scoring logic](docs/SCORING_LOGIC.md)
- [AI integration](docs/ai-integration.md)
- [Setup & deployment](docs/production.md)
- [Manual testing guide](docs/TESTING_GUIDE.md)
- [Product roadmap](docs/roadmap.md)
- [24/7 radar roadmap (future, not built)](docs/RADAR_ROADMAP.md)

## FAQ

**Does it alert me 24/7 while I'm away?** No. It only scores jobs while the feed is open in your browser.
For unattended monitoring, see the [radar roadmap](docs/RADAR_ROADMAP.md) — and in the meantime, pair UMI
with Upwork's own free saved-search email alerts.

**Will this get my account flagged?** UMI is designed to avoid that: no scraping, no auto-refresh, no
auto-bidding. It only reads the page you're on. (You are always responsible for your own ToS compliance.)

**Is AI required?** No. Heuristic scoring works fully offline with no API key. AI Deep Dive is opt-in.

**Where's my API key stored?** Locally on your device only (`chrome.storage.local`). It is never synced.

---

_A private, honest bidding assistant for serious freelancers._
