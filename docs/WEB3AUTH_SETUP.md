# Web3Auth Embedded Wallets Setup

This app supports **Web3Auth** (MetaMask Embedded Wallets) for social and email login with a wallet created in the background. When configured, users see **"Log In"** instead of the standard "Connect Wallet" flow.

## 1. Get your Client ID

1. Go to the [Embedded Wallets dashboard](https://dashboard.web3auth.io/) (same as Web3Auth).
2. Create or select your project.
3. Copy the **Client ID**.

## 2. Add to `.env.local`

In the **`frontend/`** directory, add:

```bash
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_client_id_here
```

Optional — **only if** your Web3Auth project in the dashboard is on **Sapphire Mainnet** (most projects stay on **Sapphire Devnet**):

```bash
NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet
```

If this does not match the project’s network, login fails with **Network mismatch** and signer-service **400**.

## 3. Install and run

```bash
cd frontend
npm install
npm run dev
```

Open the app — the header will show **"Log In"**. Clicking it opens the Web3Auth modal (Google, email, etc.). After login, a wallet is created in the background and all existing wagmi hooks (`useAccount`, `useChainId`, `signMessageAsync`, etc.) work as before.

## 4. Celo Sepolia – yes, the kit works on it

The Embedded Wallets SDK is EVM-compatible, so **Celo Sepolia works**. Your app is already set to use Celo Sepolia (`NEXT_PUBLIC_CHAIN_ID=11142220`).

- **If you see "Wrong network":** Use the in-app banner **Switch to Celo Sepolia** (our `NetworkChecker`), or **Reset session** and log in again (embedded wallet).
- **Celo Sepolia is not in the dashboard list** (only "Celo" mainnet may appear). Add it as a **custom chain**: [Web3Auth dashboard](https://dashboard.web3auth.io/) → your project → **Chains & Networks** → **Add custom chain** (or "Add network" / similar). Use:
  - **Chain ID:** Use **`0xA9F63C`** (hex). If you enter `11142220` (decimal), the SDK can throw "Please provide a valid chainId as hex string"—use hex in the dashboard.
  - **RPC URL / RPC Target:** `https://celo-sepolia.drpc.org` (or `https://forno.celo-sepolia.celo-testnet.org`)
  - **Block explorer:** `https://celo-sepolia.blockscout.com`
  - **Symbol / Ticker:** `CELO`
  - **Network name:** `Celo Sepolia Testnet`
  Save the network. Set it as the default chain if the dashboard allows it.
- **If you only added "Celo" (mainnet, 42220):** The app is on **Celo Sepolia** (11142220). Add Celo Sepolia as a custom chain as above so the embedded wallet can use it; otherwise the wallet may stay on mainnet or another chain.

## 5. Disable Web3Auth

Remove or comment out `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` in `.env.local`. The app falls back to **RainbowKit** (Connect with MetaMask, WalletConnect, etc.).

## Troubleshooting

### "Network mismatch" / `sapphire_mainnet` vs `sapphire_devnet` / signer-service **400**

The Client ID is tied to **one** Sapphire network in the [Web3Auth dashboard](https://dashboard.web3auth.io/) (Devnet or Mainnet). The app must request the **same** network.

- **Symptom:** Console shows `Provided network "sapphire_mainnet" does not match project network "sapphire_devnet"` (or the reverse).
- **Fix (typical):** Remove `NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet` from **Vercel** / `.env.local` so the app uses **Sapphire Devnet** (default), matching a default/free-tier project.
- **Fix (if you need Mainnet):** In the dashboard, move or configure the project for **Sapphire Mainnet**, then set `NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet`.

Do **not** set `mainnet` in env until the dashboard project is actually on Mainnet.

### "Could not validate redirect" / "please whitelist your domain" (often after choosing Google on mobile)

Web3Auth compares the app’s origin to **Whitelist URL** (also called **Allowed origins** / **Redirect** in the dashboard). If production isn’t listed, login fails **after** you pick a Google account.

1. **Web3Auth Dashboard** → [dashboard.web3auth.io](https://dashboard.web3auth.io/) → select the **same project** as your `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` → **Whitelist URL** (or **Developer Settings** → allowed URLs, depending on UI version).
2. Add **exactly** (no path, **no trailing slash**):
   - `https://dapp.decleanup.net`
3. Save, wait a minute, then on the device open **`/reset-wallet-session`** or clear site data for the dapp and try **Log In** → Google again.

Also confirm **Vercel** does **not** set `NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet` if this project is **Sapphire Devnet** (see **Network mismatch** above).

**Gmail / Google:** In [Google Cloud Console](https://console.cloud.google.com/) → **Credentials** → your OAuth **Web client** → **Authorized JavaScript origins** must include `https://dapp.decleanup.net` (same origin, no trailing slash). **Authorized redirect URIs** should still include `https://auth.web3auth.io/auth` (Web3Auth’s redirect, not your dapp URL).

### "Failed to connect with wallet. Failed to login with auth" (WalletLoginError)

This means the **auth connector** (Google, email, etc.) could not complete login. Fix in this order:

1. **Dashboard – Verifier / network**
   - In [dashboard.web3auth.io](https://dashboard.web3auth.io/) → your **Project** → check that you have a **verifier** set up and that it’s on the **same network** as your app (e.g. **Sapphire Devnet** for dev, **Sapphire Mainnet** for production). The doc says: [“Ensure you have a live verifier on the right network”](https://docs.metamask.io/embedded-wallets/troubleshooting/sdk-errors-warnings).

2. **Dashboard – Redirect / origin**
   - In the same project, open **Whitelist URL** (or **Redirect URIs**). Add the exact origin where the app runs, e.g.:
     - `http://localhost:3000` (dev)
     - `https://yourdomain.com` (production)
   - No trailing slash. If you use a different port, add it too (e.g. `http://localhost:3001`).

3. **Google (if using Google login)**
   - In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your **OAuth 2.0 Client ID** (Web application):
     - **Authorized JavaScript origins:** Add the origins where your app runs (where the login is triggered):
       - `http://localhost:3000` (dev)
       - `https://yourdomain.com` (production, no trailing slash)
     - **Authorized redirect URIs:** Add Web3Auth’s redirect URI (where Google sends the user after login):
       - `https://auth.web3auth.io/auth`
   - Then in the [Web3Auth dashboard](https://dashboard.web3auth.io/) → your project → **Social Connections** → Google, add your Google **Client ID** and **Auth Connection ID**.

4. **Browser**
   - Try a normal Chrome window (no private/incognito).
   - Disable ad blockers or strict privacy extensions on the app origin.
   - If the browser blocks third‑party cookies, allow them for the app (or test in a browser that allows them).

5. **Reset and retry**
   - Open **`/reset-wallet-session`** (or click **“Having trouble? Reset session”** if you see it), then try **Log In** again.

6. **Blank "Powered by MetaMask" pop-up**
   - Ensure **Whitelist URL** in the dashboard is exactly `http://localhost:3000` (no trailing slash).
   - Open DevTools → Console when you click Log In; look for blocked iframes, CORS, or cookie errors.
   - Try Chrome (non‑incognito), allow third‑party cookies for the site, and disable ad blockers for localhost.

7. **"Wallet is not found, Please add wallet connector for auth wallet"**
   - In the [Web3Auth dashboard](https://dashboard.web3auth.io/) → your project → **Plugins / Connectors**, ensure the **Auth** (social/email) connector is added and enabled. The embedded wallet flow needs the auth connector to be configured for the project.

8. **"Account Abstraction is not supported for the chain 0xA9F63C"**
   - Celo Sepolia is not supported for Web3Auth’s Smart Accounts (AA). Use a normal EOA instead: in the [Web3Auth dashboard](https://dashboard.web3auth.io/) → your project → **Smart accounts**, turn **off** the “Set up Smart accounts” toggle. Then the embedded wallet will work as a regular wallet on Celo Sepolia without AA.

9. **"Please provide a valid chainId as hex string in chains for chain 11142220"** / Failed to initialize modal
   - The SDK expects **chainId in hex** in the dashboard. In [Web3Auth dashboard](https://dashboard.web3auth.io/) → your project → **Chains & Networks**, edit your Celo Sepolia custom chain and set **Chain ID** to **`0xA9F63C`** (not `11142220`). Save. If the dashboard only accepts a number, try removing the custom chain there and rely on the app’s in-code chain config (the app already passes Celo Sepolia with hex chainId).

10. **403 Forbidden / "Non-200 status code: '403'" / "Error in RPC response"**
   - **From Web3Auth:** In the [Web3Auth dashboard](https://dashboard.web3auth.io/) → your project → **Whitelist URL**, add the exact origin: `http://localhost:3000` (dev) and your production URL (no trailing slash). Then use **"Having trouble? Reset session"** or open **`/reset-wallet-session`** and log in again.
   - **From Celo RPC (POST forno.celo-sepolia.celo-testnet.org 403):** The public Celo Sepolia RPC can rate-limit or block. In **`frontend/.env.local`** set:  
     `NEXT_PUBLIC_SEPOLIA_RPC_URL=https://celo-sepolia.drpc.org`  
     Restart the dev server. That uses an alternative free RPC so the app and embedded wallet can reach Celo Sepolia without 403.

11. **Shows "ApeChain" or "Chain ID 11138620" instead of Celo Sepolia (11142220)**  
   - The embedded wallet can end up on chain 11138620 (e.g. ApeChain) when the app’s RPC returns 403 or the session was created on another chain. **Fix:** (1) Use an alternative Celo Sepolia RPC (see item 9, e.g. `NEXT_PUBLIC_SEPOLIA_RPC_URL=https://celo-sepolia.drpc.org`) so RPC calls succeed. (2) Click **"Having trouble? Reset session"** (or open **`/reset-wallet-session`**), then **Log In** again so the wallet is created with the app’s chain (Celo Sepolia). The in-app **Switch to Celo Sepolia** button may not work with the embedded wallet; reset + re-login usually fixes the chain.

12. **"Cross-Origin-Opener-Policy policy would block the window.closed call"** / Google popup not closing
   - The app sends `Cross-Origin-Opener-Policy: same-origin-allow-popups`. Restart the dev server after config changes. If the console warning still appears, the popup may still work; if not, try another browser or disable strict extensions.

### Mobile Safari / iOS — login feels like it “kicks you out” or you must reopen the tab

- Embedded login uses **redirect** OAuth (not a small popup). You may briefly leave the dapp while Google/email finishes; you should land back on the same origin. If not, check **Whitelist URL** (above) includes your exact production origin.
- **Authenticator / SMS prompts** can still appear **often** if **Google (or Microsoft, etc.)** treats the login as high-risk or your account requires 2FA on each sign-in — that is separate from Web3Auth’s optional wallet MFA. Check **Google Account → Security** (recent activity, “less secure” app settings, trusted devices).
- The app sets Web3Auth **`mfaLevel: none`** so the **Embedded Wallet MFA setup** flow is not shown by default. Dashboard policies can still override; check [Web3Auth dashboard](https://dashboard.web3auth.io/) if you enabled mandatory MFA for the project.

### "Session Expired or Invalid public key" (true stale session)

The Web3Auth SDK can throw this when it tries to restore a cached session and the stored key/session is expired or invalid (e.g. after a long time, browser update, or cleared partial storage).

**Fix:** The app listens for **specific** session-expiry messages and can redirect to **`/reset-wallet-session`**. Generic OAuth **"authorization failed"** during login is **not** treated as session expiry (that previously cleared storage mid-login on mobile). If you still see session errors after a long idle period, open **`/reset-wallet-session`** manually, then **Log In** again.

### "aes/gcm: invalid ghash tag" (or other decrypt errors)

This usually means stored login/session data is stale or corrupted (e.g. after a browser update, clearing some but not all site data, or switching devices).

**Fix:** Clear this site’s data and log in again.

- **In the app:** When logged in, click **"Having trouble? Reset session"** under the wallet area in the header. That clears storage and reloads; then click **Log In** again.
- **If the app crashes before you can click:** Open **`/reset-wallet-session`** in the same tab (e.g. `https://yoursite.com/reset-wallet-session`). That page clears storage and reloads you to the home page; then click **Log In** again.
- **Manually:** Open DevTools → Application (Chrome) or Storage (Firefox) → clear **Local storage** and **Session storage** for this origin → reload the page → **Log In** again.

## Docs

- [MetaMask Embedded Wallets – React](https://docs.metamask.io/embedded-wallets/sdk/react/)
- [Quickstart (React)](https://docs.metamask.io/quickstart?product=EMBEDDED_WALLETS&framework=REACT&stepIndex=0)
- [Ethereum hooks (wagmi)](https://docs.metamask.io/embedded-wallets/sdk/react/ethereum-hooks/)
