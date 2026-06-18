# 🧠 Scoring Logic

UMI scores each job with a transparent, additive heuristic. The score is **not** a black box: every
signal that moves it is recorded and shown to you via the **"Why this score?"** breakdown on each card.

## The model

- **Base:** every job starts at **35**.
- Each signal **adds or subtracts** points and records a `{ label, delta, reason }` contribution.
- The final score is **clamped to 0–100**.

### Verdict bands

| Score | Verdict |
| :---- | :------ |
| ≥ 85 | 🔥 PRIME — high alignment, low friction |
| 65–84 | ⚖️ NEUTRAL — solid, review details |
| 45–64 | ⚠️ FRICTION — mixed signals |
| < 45 | 📉 SKIP — poor economic or skill fit |

## Signal table

| Signal | Delta | When it applies |
| :----- | :---- | :-------------- |
| **Payment verified** | +10 / **−20** | +10 if the client's billing is verified; −20 if not (professionals avoid unverified clients). |
| **Skills aligned** | up to **+40** | Proportional to how many of your Expertise Matrix keywords overlap the job's skills/description. |
| **Missing mandatory skill** | **−15 each** | Per skill the client marks mandatory that you don't have. |
| **Rate in target band** | +15 | Hourly job whose range fits your `$/hr` floor–target. |
| **Meets rate floor** | +10 | Hourly job starting at/above your floor. |
| **Underpriced (hourly)** | −15 | Max rate below your floor. |
| **Budget meets minimum** | +15 | Fixed-price ≥ your minimum. |
| **Budget too low** | −10 | Fixed-price far below your minimum. |
| **Proven spender** | +7 | Client lifetime spend in the $K/$M range. |
| **High hire rate** | +8 | Hire rate > 75%. |
| **Low hire rate** | −10 | Hire rate < 30% (likely time-waster). |
| **Preferred region** | +10 | Client in one of your preferred regions. |
| **Blacklisted region** | −30 | Client in a blacklisted zone. |
| **Saturated (50+ proposals)** | −25 | Over-crowded post. |
| **Competitive (20–50 proposals)** | −10 | Crowded post. |
| **Prior collaboration signal** | +20 | Client history references a profile like yours. |
| **Recency** | +15 / +10 / −10 | Active in minutes (+15) or <6 h (+10); stale, days/weeks old (−10). |
| **Possible ghost job** | −20 | 10+ unanswered invites with 0 interviews. |
| **Well-rated client** | +5 | Average rating ≥ 4.5★. |
| **Pays well historically** | +10 | Average hourly rate paid ≥ your floor. |

> Activity-based signals (interviews, invites, last viewed, mandatory skills, average rate paid) only
> appear after you **open a job's detail panel** — UMI reads that already-rendered panel and folds it
> into the score. Nothing is fetched in the background.

## "Why this score?" breakdown

Each card has an expandable breakdown listing every non-zero contribution, signed and sorted by impact,
each with a plain-English reason. The same breakdown is saved with bookmarked jobs in the Tracker.

## ⚠️ Connect-waster warning

When concrete red flags are present, the card shows a prominent **"Likely Connect-waster — verify before
bidding"** block listing the specific reasons:

- Payment method unverified
- Low hire rate (<30%)
- Over-saturated (50+ proposals)
- Missing required skills (listed)
- Possible ghost job (unanswered invites)
- Blacklisted region

It appears whenever there's a hard blocker (unverified payment, missing mandatory skill, blacklist) or
when the overall score is below the NEUTRAL band — so it never clutters a genuinely strong match.

## 🤖 AI Deep Dive (optional override)

For a deeper read, trigger the **Deep Dive** on a high-scoring job. UMI sends the job telemetry and your
profile summary to *your* configured model (Gemini/OpenAI) and returns:

1. **Revised score** — a cognitive re-assessment of stack/financial fit.
2. **Winning strategy** — what to mention in the proposal to stand out.
3. **Pitch hook** — the first two sentences of a cover letter.
4. **Red flags** — specific concerns found in the job text.

This is opt-in and never runs without your key. See [ai-integration.md](ai-integration.md).
