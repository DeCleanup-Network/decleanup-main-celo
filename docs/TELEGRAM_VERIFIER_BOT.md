# Telegram bot — verifier alerts for new cleanups

When a user successfully submits a cleanup onchain, verifiers get a message in a **private Telegram group** with submission ID, submitter, map link, IPFS photo links, and a link to the verifier dashboard.

## Architecture

```
User submits cleanup (onchain tx confirms)
    ↓
Frontend → POST /api/telegram/submission-created { submissionId, txHash }
    + backup: POST /api/ml-verification/verify also triggers notify (deduped)
    ↓
Server reads Submission.getSubmissionDetails (must be Pending)
    ↓
Dedup check (Supabase telegram_submission_notifications)
    ↓
Telegram Bot API → TELEGRAM_VERIFIER_CHAT_ID
```

**Embedded / gasless wallets:** submission ID is taken from the `SubmissionCreated` event in the mined tx receipt (not `submissionCount - 1`), and the real transaction hash (not UserOp hash) is passed to Telegram. The client uses `keepalive` fetch + extra retries because mobile Safari often cancels requests after long AA confirms.

## One-time setup

### 1. Create the bot

1. Open Telegram → [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow prompts, save the **bot token**
3. Set on the server (Vercel + `frontend/.env.local` for local tests):

   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdef...
   ```

### 2. Create the verifier group

1. Create a **private group** (e.g. `DeCleanup Verifiers`)
2. Add your bot as a member
3. Optional: make the bot an **admin** so it can always post
4. Send any message in the group (e.g. `test`)

### 3. Get the group chat ID

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
```

Look for `"chat":{"id":-100xxxxxxxxxx` in the JSON. That negative number is your group id.

```env
TELEGRAM_VERIFIER_CHAT_ID=-100xxxxxxxxxx
```

### 4. Supabase dedup table (recommended)

In Supabase SQL Editor, run:

`frontend/supabase/migrations/20260514_telegram_submission_notifications.sql`

Prevents duplicate alerts if the user retries or the client calls the API twice.

### 5. Deploy env vars

Add to **Vercel → Environment Variables** (Production):

| Variable | Sensitive | Example |
|----------|-----------|---------|
| `TELEGRAM_BOT_TOKEN` | Yes | from BotFather |
| `TELEGRAM_VERIFIER_CHAT_ID` | No | `-1001234567890` |

Redeploy after saving.

## Verify it works

1. **Config check:** `GET https://dapp.decleanup.net/api/telegram/submission-created`  
   Should return `{ "configured": true }`.

2. **Submit a test cleanup** on mainnet (or your target chain).

3. The verifier group should receive a message within a few seconds.

## Message contents

Each alert includes:

- Submission **#id**
- **Submitter** wallet address
- **Timestamp** (UTC)
- **Google Maps** link from onchain lat/lng
- **Before / after** IPFS links (via `NEXT_PUBLIC_IPFS_GATEWAY`)
- **Impact form** / **recyclables** flags
- Link to **`/verifier`** on your app URL (`NEXT_PUBLIC_WEB_APP_URL`)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No message, API returns `telegram_not_configured` | Set both env vars on Vercel and redeploy |
| `telegram_error: chat not found` | Wrong `TELEGRAM_VERIFIER_CHAT_ID`; re-run `getUpdates` |
| `telegram_error: bot was blocked` | Re-add bot to the group |
| `already_notified` | Normal on retry; dedup table already has this submission id |
| `not_pending` | Submission already approved/rejected; no alert sent |
| Embedded wallet submit, no Telegram | Fixed: event-log submission ID + keepalive notify + ML-route backup; redeploy frontend |

## Security notes

- **Never** commit `TELEGRAM_BOT_TOKEN` to git.
- The API route rate-limits by IP and verifies the submission exists onchain as **Pending** before sending.
- Only verifiers who are in the private group see alerts; keep the group invite-only.

## Optional: manual test without a full cleanup

```bash
curl -X POST https://dapp.decleanup.net/api/telegram/submission-created \
  -H "Content-Type: application/json" \
  -d '{"submissionId":"0"}'
```

Use a real pending submission id from your contract for a successful send.
