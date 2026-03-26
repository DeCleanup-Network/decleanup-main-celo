# Paymaster / Account Abstraction plan (DeCleanup on Celo Sepolia)

## Goal

Enable **gasless transactions** for key flows (e.g. cleanup submission, claim) by wrapping the Web3Auth EOA in a **smart account** and using a **bundler + paymaster** (Pimlico) on **Celo Sepolia**.

---

## Chain and endpoints

- **Celo Sepolia** chainId: **11142220** (slug: `celo-sepolia`).
- **Pimlico** supports Celo Sepolia. Use:
  - Bundler + paymaster RPC:  
    `https://api.pimlico.io/v2/celo-sepolia/rpc?apikey=YOUR_PIMLICO_API_KEY`
  - Or by chainId:  
    `https://api.pimlico.io/v2/11142220/rpc?apikey=YOUR_PIMLICO_API_KEY`

Get an API key: [Pimlico – Create API key](https://docs.pimlico.io/guides/create-api-key).

---

## Architecture

```
Web3Auth EOA (signer) → Smart Account (e.g. Safe/Kernel/Simple) → Pimlico Bundler → Pimlico Paymaster (sponsors gas)
```

- **Web3Auth embedded wallet** = EOA (private key in MPC). No private key is exported; we use the wallet’s signer (e.g. via wagmi `WalletClient` or provider).
- **Smart account** = ERC-4337 account (Safe, Kernel, or SimpleAccount) whose “owner” is that EOA (or a signer wrapping the Web3Auth provider).
- **Bundler** = Pimlico; submits user operations to the chain.
- **Paymaster** = Pimlico’s verifying paymaster; sponsors gas so the user pays nothing.

---

## Implementation steps

1. **Dependencies**  
   Add `permissionless` (and any peer deps Pimlico docs specify) for:
   - Smart account (e.g. Safe via `toSafeSmartAccount` or SimpleAccount).
   - Pimlico bundler + paymaster clients (`createPimlicoClient`, `createSmartAccountClient`).

2. **Env**  
   - `NEXT_PUBLIC_PIMLICO_API_KEY` or `PIMLICO_API_KEY` for the Pimlico RPC URL (bundler + paymaster).

3. **Signer from Web3Auth**  
   - From wagmi: `useWalletClient()` gives a `WalletClient` (backed by Web3Auth).
   - Convert that to a viem `Account` (or signer type permissionless expects): implement a small adapter that uses `walletClient.request({ method: 'eth_signTypedData_v4', ... })` (and address) so it matches the `Account` interface expected by `toSafeSmartAccount` / `signerToSimpleSmartAccount`.

4. **Smart account + client**  
   - Use Celo Sepolia (chainId 11142220) and Pimlico URL for `celo-sepolia`.
   - Create smart account with owner = Web3Auth-derived signer.
   - Create `SmartAccountClient` with:
     - `bundlerTransport: http(pimlicoUrl)`
     - `paymaster: pimlicoClient` (so `sponsorUserOperation` is used and gas is sponsored).

5. **Use in app**  
   - In flows that currently send a tx from the connected wallet (e.g. cleanup submit, claim), optionally use the smart account client instead of the raw EOA so the tx is gasless.
   - Keep EOA path as fallback if AA is disabled or fails.

---

## Celo Sepolia specifics

- Pimlico supported chain: **Celo Sepolia**, chainId **11142220**, slug **celo-sepolia**.
- Do **not** use chainId 44787 (Optimism Sepolia) for Celo.

---

## References

- [Pimlico – Supported chains](https://docs.pimlico.io/guides/supported-chains) (Celo + Celo Sepolia).
- [Pimlico – Send your first gasless transaction](https://docs.pimlico.io/permissionless/tutorial/tutorial-1).
- [permissionless.js](https://docs.pimlico.io/references/permissionless/v0_1) (smart accounts, bundler, paymaster).
