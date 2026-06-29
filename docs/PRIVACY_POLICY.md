# Privacy Policy

**Effective date:** April 23, 2026  
**Operator:** DeCleanup Network (“DeCleanup”, “we”, “us”, “our”).

This policy has been **reviewed by qualified privacy counsel** for the DeCleanup Rewards platform. Contact counsel before material changes if your user base, data flows, or jurisdictions change.

---

## 1. Scope

This policy describes how we collect, use, and share information when you use the DeCleanup **website, APIs, and related services** (the “Service”).

## 2. Information we may collect

Depending on how you use the Service, we may process:

| Category | Examples |
|----------|-----------|
| **Wallet & onchain data** | Public wallet and smart-account addresses, transaction hashes, UserOperation receipts, token balances, contract interaction history (this data is **often public onchain**). |
| **Account sign-in (embedded)** | If you sign in with Google or email: OAuth subject id, email address, and session tokens processed by our auth provider and **Auth.js**; we do **not** store your raw private key. |
| **Passkeys (optional)** | WebAuthn credential ids and public keys stored to verify unlock; biometric data stays on your device. |
| **Cleanup submissions** | Photos, descriptions, locations, optional impact or recyclables forms - typically uploaded to **IPFS** or similar storage via our servers. |
| **Technical logs** | IP address, user agent, timestamps, error logs, API rate-limit counters. |
| **Account / application data** | If you use verifier onboarding, Hypercert requests, or similar features backed by **Supabase** (or another DB): application status, certificate request metadata, publish status, reviewer notes you provide, email if you supply it. |
| **Communications** | Messages you send to support channels. |

We do **not** intentionally collect private keys or seed phrases. Encrypted wallet backups you download stay **on your device** unless you choose to store them elsewhere. **Never share your seed phrase, backup file, or signing password** with anyone claiming to be support.

## 3. How we use information

We use information to:

- Operate, secure, and improve the Service.
- Process submissions, run verification workflows, and interface with smart contracts you approve.
- Debug outages, prevent abuse, and enforce our **Terms of Service**.
- Comply with law and respond to lawful requests.

## 4. Legal bases (EEA/UK-style summary)

Where GDPR-style rules apply, we rely on **contract** (to provide the Service), **legitimate interests** (security, abuse prevention, analytics that are not invasive), and **legal obligation** where required. **Consent** may apply to optional cookies or marketing - configure your cookie banner accordingly.

## 5. Sharing

We may share information with:

- **Infrastructure providers** (hosting, RPC, IPFS pinning, databases, email).
- **Analytics** vendors if enabled.
- **Law enforcement or regulators** when required by law or to protect rights and safety.

We **do not sell personal information** as traditionally defined (no money for personal rows). If you use ad-tech that constitutes “sale” or “sharing” under US state law, **update this section** and offer required opt-outs.

## 5a. Where we store and process data

Personal data may be processed in the following regions and services:

| Provider | Purpose | Region (as configured) |
|----------|---------|------------------------|
| **Supabase** | Database (verifier applications, hypercert requests, impact portfolios, auth-related tables) | **US East (Ohio) — `us-east-2`** |
| **Vercel** | Web application hosting and serverless API routes | **US East — `iad1` (Washington, D.C.)** |
| **Pinata** | IPFS pinning for cleanup photos and metadata | Per your Pinata account (check Pinata dashboard) |
| **Resend** | Transactional email (magic links, notifications) | Per Resend account region |
| **Celo RPC providers** | Onchain reads and transaction broadcast | Distributed; onchain data is public |
| **Self-hosted VPS** (if used) | ML verification, IPFS upload proxy, or legacy hosting | Per your VPS provider and region |

Onchain wallet activity and IPFS-pinned content may be replicated globally and remain publicly accessible outside our control.

## 6. International transfers (global audience)

Users may access the Service from **many countries**. Personal data may be processed in **any jurisdiction** where we or our subprocessors operate. **Laws that protect you where you live** (for example GDPR in the EEA/UK, or state privacy laws in the US) may still apply to our processing of your information. Use appropriate safeguards (for example Standard Contractual Clauses for EEA/UK exports) where your counsel requires them.

## 7. Retention

We retain data as long as needed for the purposes above, then delete or anonymize it **unless a longer period is required by law** or legitimate backup/archival practices.

## 8. Security

We use reasonable technical and organizational measures. **No method of transmission or storage is 100% secure**, especially when content is replicated on public IPFS gateways.

## 9. Your rights

Depending on **where you live**, you may have rights to **access, correct, delete, export, or restrict** processing of your personal data, and to **object** to certain processing. Contact us using the method published on **[decleanup.net](https://decleanup.net)** or in the deployed app. You may also lodge a complaint with a **supervisory authority in your country or region**, where that is available.

## 10. Children

The Service is **not directed at children under 13** (or 16 where stricter rules apply). Do not use the Service if you are under the applicable age.

## 11. Third-party links

The Service may link to external sites (explorers, social, governance). Their privacy policies govern those sites.

## 12. Changes

We may update this policy by posting a new effective date. Check this document periodically.

## 13. Contact

Use the official privacy or support contact published on **[decleanup.net](https://decleanup.net)** or in the deployed application. Add a dedicated privacy inbox when you publish one.

---

For the in-app copy, mirror this file at **`/privacy`** on your deployed Next.js site.
