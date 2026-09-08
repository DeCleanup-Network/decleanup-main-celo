# Contributor emails → Google Sheet

When a cleanup impact report lists **contributor emails**, DeCleanup appends one sheet row per email with cleanup details (where, when, how, etc.).

## What gets written (one row per email)

| Column | Source |
|--------|--------|
| recordedAt | Server timestamp (UTC) |
| submissionId | Onchain cleanup id |
| txHash | Submit transaction (if known) |
| contributorEmail | Listed email |
| submitterWallet | Submitter smart account / wallet |
| cleanupDate | Impact form date |
| campaignName | Optional campaign |
| locationType | Beach, park, … |
| latitude / longitude / mapsUrl | GPS from submission |
| area / areaUnit | Impact form |
| weight / weightUnit / bags | Impact form |
| hours / minutes / durationLabel | Time spent |
| wasteTypes | Selected types |
| howScopeOfWork | Auto scope / how |
| environmentalChallenges | Form |
| preventionIdeas | Form |
| additionalNotes | Form |
| rightsAssignment | Photo license preset |
| impactIpfsCid / impactIpfsUrl | IPFS impact JSON |
| verifierUrl | Link to verifier dashboard |

## Setup (Google Apps Script webhook)

1. Create a Google Sheet (e.g. `DeCleanup Impact Contributors`).
2. Row 1 headers (exact keys help matching):

```
recordedAt	submissionId	txHash	contributorEmail	submitterWallet	cleanupDate	campaignName	locationType	latitude	longitude	mapsUrl	area	areaUnit	weight	weightUnit	bags	hours	minutes	durationLabel	wasteTypes	howScopeOfWork	environmentalChallenges	preventionIdeas	additionalNotes	rightsAssignment	impactIpfsCid	impactIpfsUrl	verifierUrl
```

3. **Extensions → Apps Script**, paste:

```javascript
const SHEET_NAME = 'Contributors' // or your tab name

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const rows = body.rows || []
    if (!rows.length) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: 0 }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0]
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(String)

    const values = rows.map((row) =>
      headers.map((h) => (row[h] != null ? String(row[h]) : ''))
    )
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values)

    return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: rows.length }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
```

4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (the URL is a secret; do not publish it)
5. Copy the Web App URL into server env:

```env
CONTRIBUTOR_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/…/exec
```

6. Redeploy the dapp (Vercel / VPS). Check: `GET /api/impact/contributors-sheet` → `{ "configured": true }`.

## Notes

- If the env var is missing, submits still succeed; sheet write is skipped.
- Client calls the API after a successful onchain submit when at least one contributor email was listed.
- Do not commit the webhook URL to git.
