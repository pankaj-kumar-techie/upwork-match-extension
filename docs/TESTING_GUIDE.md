# 🧪 Manual Testing & Verification Guide

There is no automated test suite — verification is manual, the norm for an unpacked MV3 extension. Work
through the phases below after loading the extension at `chrome://extensions/`.

## Phase 0: Load

- Load Unpacked → confirm the extension loads with **no manifest or service-worker errors**.

## Phase 1: Profile sync

1. Open your [Upwork profile](https://www.upwork.com/freelancers/~).
2. Click **⚡ Sync MY Intelligence** (or use the popup's **Begin High-Alpha Sync** with your profile URL).
3. Verify:
   - The button shows **"✅ [X] Data Points Synced!"**.
   - Popup → Settings → **Expertise Matrix** is populated; `$/hr` floor & target are filled.
4. **Failure path:** if Upwork's layout has changed and nothing extracts, the button should show
   **"⚠️ Couldn't read profile — Upwork layout may have changed"** rather than saving empty data.
5. **Onboarding guard:** with the profile URL blank, clicking Sync should focus the URL field and show a
   hint — it must **not** open a dead tab.

## Phase 2: Feed scoring & explainability

1. Go to [Find Work → Most Recent](https://www.upwork.com/nx/find-work/most-recent).
2. Verify each job tile gets a score badge; strong matches get an emerald border.
3. Click **"Why this score?"** on a card → confirm a signed (+/−) breakdown with reasons appears.
4. Find a weak/risky job → confirm the **"⚠️ Likely Connect-waster"** block lists concrete reasons
   (unverified payment, low hire rate, 50+ proposals, missing required skills, etc.).
5. Open a job's **detail panel** → reopen the feed card and confirm activity (interviews/invites/last
   viewed) and mandatory skills are now reflected.

## Phase 3: AI Deep Dive (optional)

1. Popup → set **AI Model** + paste your **API key** → Deploy.
2. On a high-scoring job, click the **circle/info icon** on the badge.
3. Verify "Consultant is analyzing…" then a revised score, **Winning Strategy**, **Pitch Hook**, and any
   red flags appear, reflecting the actual job text.

## Phase 4: Notifications & dedup

1. Set a low **Notify Threshold** so matches trigger easily.
2. Confirm a **desktop notification** fires for a qualifying job (click it → the job opens).
3. **Reload the page** → confirm the **same job does NOT re-notify** (cross-session dedup).

## Phase 5: Tracker

1. Click the **bookmark icon** on a card.
2. Popup → **Tracker** tab → confirm the job appears **with its score and "Why this score?" breakdown**.
3. Click **✕ Remove** → it disappears and stays gone after reopening the popup.

## Phase 6: Privacy & settings

1. Save settings with a valid API key.
2. DevTools → **Application → Storage**: confirm `aiKey` is in **chrome.storage.local**, *not* in the
   synced `settings` object.
3. Click **Reset all settings** → confirm fields clear and tracked jobs are removed.

---

_If any phase fails, open DevTools (`F12 → Console`) on Upwork and check the `[MatchIntel]` logs._
