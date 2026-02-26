# 🧪 Manual Testing & Verification Guide

Follow these steps to ensure Upwork Match Intelligence (UMI) is correctly configured and providing accurate telemetry.

## Phase 1: Engine Calibration (Sync)

1.  **Open Upwork**: Navigate to your [Freelancer Profile page](https://www.upwork.com/freelancers/~).
2.  **Trigger Sync**: Click the blue **"⚡ Sync MY Intelligence"** button injected at the top of your profile.
3.  **Verify Extraction**:
    - The button should change to "✅ [X] Data Points Synced!".
    - Open the extension popup (top right browser icon).
    - Go to the **Settings** tab.
    - Confirm the **Expertise Matrix** (Keywords) contains your skills.
    - Confirm **$/hr Min** and **Target** are populated.

## Phase 2: Feed Intelligence (Scanning)

1.  **Navigate to Feed**: Go to [Find Work / Most Recent](https://www.upwork.com/nx/find-work/most-recent).
2.  **Observe Injections**:
    - Every job tile should now have an **ALPHA** badge on the left.
    - High-quality matches should have an **Emerald Glow** (border).
3.  **Data Verification**:
    - Check the **Competition Heat** label. Does it match the proposals count shown by Upwork?
    - Check **Skills Alignment**. Does it highlight skills you actually possess?
    - Check **Missing Mandatory Skills**. Find a job you aren't qualified for and verify if the red warnings appear.

## Phase 3: AI Deep Dive (Cognitive Analysis)

1.  **Configure API**: In the popup Settings, select your **AI Model** (Gemini or OpenAI) and paste your **API Key**.
2.  **Trigger AI**:
    - Find a job with a high score (>85%).
    - Click the **Circle/Info icon** in the top right of the UMI badge.
3.  **Verify Insight**:
    - The Advice strip should change to "Consultant is analyzing...".
    - After 3-5 seconds, a purple **Strategic Verdict** and **Pitch Hook** should appear.
    - Verify that the "Winning Strategy" reflects the actual job text.

## Phase 4: Automation & Persistence

1.  **Tracker Consistency**:
    - Click the **Bookmark/Save icon** on any UMI badge.
    - Open the popup and go to the **Tracker** tab.
    - Confirm the job appears with its score and metadata.
2.  **Notification Test**:
    - Keep Upwork open in a background tab.
    - Wait for a "Prime" match to appear.
    - Verify if a Chrome system notification appears with the job title.

---

_If any phase fails, check the Browser Console (F12 > Console) for [MatchIntel] logs._
