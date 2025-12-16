# Testing Checklist - Celo Sepolia Deployment

## ✅ Completed Setup
- [x] Contracts deployed to Celo Sepolia (11142220)
- [x] RecyclablesReward deployed and wired
- [x] Frontend switched from Alfajores to Sepolia

## 📋 Pre-Testing Checklist

### 1. Frontend Environment Variables
Create/update `frontend/.env.local` with these addresses:

```env
# Network
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org

# Contract Addresses (from Ignition deployment)
NEXT_PUBLIC_SUBMISSION_CONTRACT=0xB9505fEf5A4CDD32504E4cCA7E8A4518371878B6
NEXT_PUBLIC_VERIFICATION_CONTRACT=0xB9505fEf5A4CDD32504E4cCA7E8A4518371878B6
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0xB9505fEf5A4CDD32504E4cCA7E8A4518371878B6
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x69715d43EA6D46F65045FCe2391D9B7F89ec819F
NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT=0x69715d43EA6D46F65045FCe2391D9B7F89ec819F
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0x8D71Cd7445423CD42293E196B91E47f085E81BCf
NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=0x8D71Cd7445423CD42293E196B91E47f085E81BCf
NEXT_PUBLIC_DCU_TOKEN_CONTRACT=0xa282c26245d116aB5600fBF7901f2E4827c16B7A
NEXT_PUBLIC_RECYCLABLES_CONTRACT=0xf8f9db39f83ea40d4f9aca72cdbec74b8f5a2900

# Optional but recommended
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-project-id>
PINATA_API_KEY=<your-pinata-key>
PINATA_SECRET_KEY=<your-pinata-secret>
```

## 🧪 Testing Steps

### Step 1: Start Frontend Dev Server
```bash
cd frontend
npm run dev
```

### Step 2: Manual UI Testing
1. **Wallet Connection**
   - [ ] Open http://localhost:3000
   - [ ] Click "Connect Wallet"
   - [ ] Verify it connects to Celo Sepolia (chain ID 11142220)
   - [ ] Check wallet address displays correctly

2. **Network Detection**
   - [ ] Verify app shows "Celo Sepolia" network
   - [ ] Check block explorer links point to Celo Sepolia explorer
   - [ ] Verify no "wrong network" errors

3. **Contract Reads**
   - [ ] Dashboard loads without errors
   - [ ] Check console for any contract read errors
   - [ ] Verify user stats display (even if 0)

4. **Navigation**
   - [ ] All pages load (Dashboard, Profile, Cleanup, Verifier, Leaderboard)
   - [ ] No 404 errors
   - [ ] Links work correctly

### Step 3: Unit Tests
```bash
cd frontend
npm test
```

Expected: All tests pass (may have some failures if contracts not fully initialized)

### Step 4: Contract Interaction Tests (if possible)
- [ ] Try submitting a cleanup (if you have test funds)
- [ ] Check if submission appears in verifier view
- [ ] Verify contract events are emitted

## 🐛 Common Issues to Watch For

1. **Wrong Network**: App tries to connect to wrong chain
   - Fix: Check `NEXT_PUBLIC_CHAIN_ID=11142220` in `.env.local`

2. **Contract Not Found**: Errors reading contracts
   - Fix: Verify all contract addresses in `.env.local` match deployment

3. **RPC Errors**: Can't connect to Celo Sepolia
   - Fix: Check `NEXT_PUBLIC_SEPOLIA_RPC_URL` is correct

4. **WalletConnect Issues**: Can't connect wallet
   - Fix: Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env.local`

## 📝 Next Steps After Testing

1. Fix any issues found
2. Test with real transactions (if you have test CELO)
3. Verify contract interactions work end-to-end
4. Prepare for mainnet deployment

