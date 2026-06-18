# Radar Roadmap — Safe 24/7 Unattended Job Alerts (Future, Not Built)

> **Status:** Design only. None of this ships inside the browser extension. This document exists so the
> "alert me 24/7 without sitting at the screen" goal has a *safe, Terms-compliant* path on record.

## Why this can't be part of the extension

The UMI extension is a **bidding assistant**: it scores jobs on the page you are actively viewing. It
cannot be a 24/7 radar because:

1. **A browser extension stops when the browser stops.** Close the laptop and monitoring ends — you miss
   every job posted while you're away. This is the #1 stated weakness of every Chrome-extension alert
   tool on the market.
2. **Making it poll/auto-refresh the feed would cross into scraping.** Upwork's Terms explicitly prohibit
   scraping job feeds, browser-automation that drives the UI, and "any unauthorized API usage that
   bypasses the standard web interface." Bolting a refresh loop onto the extension is exactly the banned
   pattern — and it's what gets accounts flagged.

So unattended monitoring must run **outside** the browser, against an **authorized** data source.

## What Upwork's Terms allow vs. ban (as of 2026)

| ✅ Allowed | ❌ Banned |
|---|---|
| AI for **job-matching notifications** | Scraping job feeds / bulk-copying postings |
| Drafting proposals, as long as **a human reviews and sends** | Auto-submitting proposals via bots/scripts |
| Using the **official Upwork API** with an approved key | Browser automation (Selenium/Puppeteer) on the proposal flow |
| Notifying yourself (Telegram/email/webhook) | Account masquerading / tools acting as you |

The safe radar therefore: **reads** new jobs via the official API, **scores** them, and **notifies** a
human — and never bids.

## Architecture (recommended)

```
┌────────────────────┐   poll (read-only)    ┌──────────────────────────┐
│ Official Upwork API │ ───────────────────▶ │  Radar service (yours)    │
│ api.upwork.com/     │   job search query    │  - own/self-hosted        │
│ graphql             │                       │  - your Upwork API key    │
└────────────────────┘                       │  - reuse UMI scoring      │
                                              └────────────┬─────────────┘
                                                           │ match ≥ threshold
                                                           ▼
                                              ┌──────────────────────────┐
                                              │ Telegram bot / email /    │
                                              │ webhook → your phone      │
                                              └──────────────────────────┘
                                                           │ you tap through
                                                           ▼
                                              ┌──────────────────────────┐
                                              │ Browser + UMI extension   │
                                              │ scores the page, drafts   │
                                              │ pitch — YOU click send    │
                                              └──────────────────────────┘
```

- **Data source:** Upwork **GraphQL API** (`api.upwork.com/graphql`). It supports read operations
  including **job search**. It deliberately has **no** mutation to submit a proposal or spend Connects —
  which is fine, because the human does that in the browser.
- **Auth:** request an application/API key in the [Upwork Developer portal](https://www.upwork.com/developer).
  **This is the gating step** — without approval, there is no compliant unattended path, and the fallback
  is Upwork's own free saved-search email alerts.
- **Scoring:** reuse the extension's `JobScorer` logic (`content/content.js`) so radar alerts carry the
  same honest score + "why" + Connect-waster flags as the on-page badges. Extract the scorer into a
  shared module so both the extension and the radar import it.
- **Privacy:** keep the design own-key / self-hostable. The user supplies their own Upwork API key and
  (optional) AI key; the service holds no central database of other users' job data. This preserves UMI's
  privacy-first wedge.
- **Notify:** Telegram bot is the simplest real-time channel; email/webhook are alternatives. Dedupe by
  job id; respect a quiet-hours window.

## Minimal MVP steps

1. Apply for an Upwork API key (developer portal). **Blocked until approved.**
2. Stand up a tiny scheduled worker (cloud function / cron / self-hosted) that runs a saved job-search
   GraphQL query every N minutes.
3. Import the shared `JobScorer`; score each new job against the user's profile/thresholds.
4. Push matches above the notify threshold to Telegram, with the score, the top "why" reasons, and the
   job link. **No auto-bid.**
5. Dedupe so the same job never alerts twice (mirror the extension's `notifiedJobs` 7-day prune).

## Fallback if no API key

Upwork's **free saved-search email alerts** already provide unattended notifications (slower — typically
20–60 min, batched). Pair them with the UMI extension: the email is your radar, and when you open the
job, UMI scores it and flags the traps. This needs zero code and is fully sanctioned.
