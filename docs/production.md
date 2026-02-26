# 📄 Production & Deployment Guide

This guide details the steps to deploy and maintain the Upwork Match Intelligence extension in a professional environment.

## 📦 Deployment Steps

1. **Source Control**: Ensure all files in `content/`, `popup/`, and `docs/` are committed.
2. **Unpacked Loading**:
   - Open Chrome `chrome://extensions/`.
   - Enable **Developer Mode**.
   - Click **Load Unpacked** and select the root directory of this extension.
3. **Intel Calibration**:
   - Open your Upwork Profile.
   - Click the green **"Sync MY Intelligence"** button.
   - Verify that your keywords and rates appear correctly in the extension popup.

## ⚙️ Configuration Reference (Intel Pool)

| Key                | Description                                 | Format           |
| :----------------- | :------------------------------------------ | :--------------- |
| `keywords`         | The semantic pool used for matching.        | Array of Strings |
| `hourlyRateMin`    | Your preferred floor rate.                  | Integer          |
| `minScoreToNotify` | Threshold for "Alpha Alerts" (Default: 85). | Integer (0-100)  |
| `webhookUrl`       | Destination for remote match delivery.      | URL String       |

## 🚀 Advanced Best Practices

- **Regular Sync**: We recommend re-syncing your profile every 14 days or whenever you update your specialized profile skills to keep the "Intel Pool" fresh.
- **Negative Filtering**: If you see too many irrelevant jobs, add the specific keywords you want to avoid into your "Intel Pool" and the engine will naturally de-prioritize them (future update will include explicit negative keywords).
- **Webhook optimization**: Use Discord "Embeds" or Telegram "MarkdownV2" (handled automatically by our background logic) for the cleanest remote leads.

## 🔍 Troubleshooting

- **Badges not appearing**: Check if Upwork has updated their DOM class names. Update `SELECTORS` in `content.js` to match the latest `data-test` attributes.
- **Sync failing**: Ensure you are on a "Public" profile view, not an "Edit" view.
