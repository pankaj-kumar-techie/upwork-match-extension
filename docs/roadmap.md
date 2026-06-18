# 🚀 Product Roadmap

UMI's mission: be the **private, honest bidding assistant** that helps serious freelancers spend Connects
only on jobs worth winning — without ever risking their account.

## 🟢 Shipped (v1.1)

- ✅ **On-page match scoring** — every job card scored as it renders.
- ✅ **Explainable scoring** — "Why this score?" breakdown on every card and in the Tracker.
- ✅ **Connect-waster warnings** — concrete red flags surfaced before you bid.
- ✅ **One-click Profile Sync** — builds your Expertise Matrix (fails loudly if the layout changes).
- ✅ **Activity enrichment** — reads the job detail panel you open into the score.
- ✅ **Desktop notifications** — de-duplicated across reloads (7-day memory).
- ✅ **Optional AI Deep Dive** — Gemini/OpenAI revised score, strategy, and pitch from your own key.
- ✅ **Local Tracker** — bookmark, view, and remove saved jobs.
- ✅ **Privacy hardening** — API key kept device-local; clear privacy messaging.

## 🟡 Next

- 🏗️ **Shared scorer module** — extract `JobScorer` so it can be reused outside the content script.
- 🏗️ **Smart summarizer** — bullet-point reduction of long, messy job descriptions (local-first).
- 🏗️ **Keyword suggestions** — propose Expertise Matrix additions based on the jobs you bookmark.
- 🏗️ **Tone-matched pitch drafts** — adapt the AI pitch hook to the client's writing style.

## 🔵 Exploring

- **Contract risk scanner** — flag predatory terms or unrealistic scope in job text.
- **Client intent signals** — surface micro-manager vs. high-trust patterns from visible reviews.
- **24/7 radar (separate backend)** — official-API-based unattended alerts. Designed in
  [RADAR_ROADMAP.md](RADAR_ROADMAP.md); **not** built into the extension because safe 24/7 monitoring
  can't live in a browser tab.

## 🚫 Explicitly out of scope

To keep UMI ToS-safe and account-safe, we will **not** build:

- Auto-submitting proposals or pre-filling/sending applications (Upwork prohibits auto-apply).
- Background fetching, scraping, or auto-refreshing the feed.
- Any tool that acts on Upwork on your behalf without a human clicking send.

UMI assists the human; the human always decides and submits.
