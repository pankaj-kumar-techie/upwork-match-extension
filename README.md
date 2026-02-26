# Upwork Match Intelligence

A personal AI job intelligence layer for your Upwork workflow. This Chrome Extension (Manifest V3) helps you find the best jobs faster by calculating a real-time match score based on your unique profile and preferences.

## 🚀 Features

- **Profile Intelligence**: Automatically analyzes your Upwork freelancer profile to configure your ideal matching settings. No manual setup required!
- **Local Match Scoring**: Computes a 0-100% score for every job card visible on Upwork.
- **High Match Highlighting**: Automatically highlights jobs with a score > 85% with a distinct border and glassmorphism badge.
- **Smart Preferences**:
  - **Keywords**: Match against job titles and descriptions (auto-populated from your profile skills).
  - **Rate/Budget**: Set your ideal hourly range or fixed-price minimum (auto-calibrated from your profile rate).
  - **Location**: Prioritize clients from specific countries.
- **Automation**:
  - **Webhooks**: Automatically send high-match job links to Telegram or Discord.
  - **System Notifications**: Get a desktop alert when a perfect match is found.
- **Job Tracker**: Save interesting jobs to your local tracker for later review.

## 🛠️ Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked**.
4. Select the `upwork-match-extension` folder.

## ⚙️ Configuration

1. **Auto-Sync (Recommended)**: Navigate to your Upwork profile (e.g., `https://upwork.com/freelancers/~...`). Click the **"Sync Profile to Match Intel"** button that appears.
2. **Manual Tweaks**: Click the extension icon in your toolbar to fine-tune your Hourly Rate, Budget, or Keywords.
3. Add **Keywords** (e.g., `React, Python, LLM`).
4. (Optional) Paste a **Telegram or Discord Webhook URL** to get remote alerts.
   - _Telegram format_: `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>`
   - _Discord format_: Standard Webhook URL.

## 📖 Documentation

For detailed technical and user guides, please refer to the **[docs/ directory](./docs/index.md)**:

- **[Scoring Engine Logic](./docs/scoring-logic.md)**: Understand how matches are calculated.
- **[Architecture & Design](./docs/architecture.md)**: Technical breakdown of the extension.
- **[Production Guide](./docs/production.md)**: Webhooks and automation setup.

---

_Built for top-tier freelancers. Precision matching. Zero-cost intelligence._
