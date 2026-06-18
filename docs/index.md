# 📁 Project Documentation Index

Welcome to the **Upwork Match Intelligence (UMI)** documentation. UMI is a privacy-first, ToS-safe
Chrome (MV3) extension that scores Upwork jobs on the page you're browsing and explains *why* — so you
stop wasting Connects on bad jobs.

## 📖 Available Guides

1. **[Architecture & Design](architecture.md)** — Manifest V3 layout; how the content script, service
   worker, and popup fit together; the storage model.
2. **[Scoring Logic](SCORING_LOGIC.md)** — The full signal-by-signal scoring table, the
   "Why this score?" breakdown, the Connect-waster warning, and verdict bands.
3. **[AI Integration](ai-integration.md)** — Optional Gemini/OpenAI Deep Dive, configuration, and the
   privacy model for your API key.
4. **[Setup & Deployment](production.md)** — Install, profile sync, and calibration.
5. **[Manual Testing Guide](TESTING_GUIDE.md)** — Step-by-step verification of every feature.
6. **[Product Roadmap](roadmap.md)** — What's shipped and what's planned.
7. **[24/7 Radar Roadmap](RADAR_ROADMAP.md)** — The official-API approach to unattended alerts
   (designed, intentionally **not** built into the extension).

## 🚀 Key Features

- **Explainable Match Score** — every card shows a 0–100 score with a signed "Why this score?" breakdown.
- **Connect-waster warnings** — concrete red flags surfaced before you bid.
- **One-click Profile Sync** — builds your Expertise Matrix from your Upwork profile.
- **Activity enrichment** — reads the visible "Activity on this job" panel into the score.
- **Optional AI Deep Dive** — revised score, winning strategy, and pitch hook from *your* API key.
- **Local Tracker** — bookmark jobs with their score and breakdown retained.

## 🔒 Privacy at a glance

No backend server. Settings sync via your browser; **your API key and saved jobs stay local to the
device**. No scraping, no auto-refresh, no auto-bidding.

---

_Maintained by the UMI project._
