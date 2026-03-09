# Security & Best Practices Checklist - DeCleanup Network

This document contains all security rules, best practices, and implementation requirements for the DeCleanup Network production deployment on Celo.

## 🔒 Security Requirements

### 1. Node.js Security Update ⚠️ **URGENT**
- **Current Version**: v22.12.0 ❌ **VULNERABLE**
- **Required Version**: v22.22.0+ ✅
- **Issue**: [Node.js January 2026 async_hooks DoS vulnerability](https://nodejs.org/en/blog/vulnerability/january-2026-dos-mitigation-async-hooks)
- **Impact**: Affects Next.js applications using AsyncLocalStorage (request context tracking)
- **Action Required**:
  ```bash
  # Local development
  nvm install 22.22.0
  nvm use 22.22.0
  nvm alias default 22.22.0
  
  # VPS (207.180.203.243)
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  node --version  # Verify v22.22.0+
  ```
- **Files to Check**:
  - `docs/NODEJS_VULNERABILITY_FIX.md` - Detailed upgrade instructions
- **Deadline**: Before next production deployment

### 2. Rate Limiting ⚠️ **MISSING**
- **Implementation**: Rate limiting on API endpoints
- **Location**: `frontend/src/app/api/*`
- **Requirements**:
  - ⚠️ Rate limits needed for:
    - `/api/ipfs/upload`: 10 requests/minute per IP
    - `/api/ml-verification/verify`: 5 requests/minute per user
    - General API: 100 requests/minute per IP
  - ⚠️ Use `upstash/ratelimit` or `express-rate-limit`
  - ⚠️ Return `429 Too Many Requests` with `Retry-After` header
- **Action Required**: Implement rate limiting utility
- **Priority**: High

### 3. Input Validation ⚠️ **PARTIAL**
- **Implementation**: Frontend and backend validation
- **Requirements**:
  - ✅ Frontend form validation (cleanup submission)
  - ⚠️ Backend API validation needs improvement
  - ⚠️ JSON depth validation (max 32 levels) - Prevents DoS
  - ⚠️ Size limits (10MB images, 1MB JSON)
  - ⚠️ HEIC file validation and conversion
  - ⚠️ GPS coordinate validation (-90 to 90 lat, -180 to 180 lng)
- **Files to Check**:
  - `frontend/src/features/cleanup/pages/page.tsx` - Frontend validation
  - `frontend/src/app/api/ml-verification/verify/route.ts` - Backend validation
- **Action Required**: Add backend input validation utility
- **Priority**: High

### 4. API Keys Security ✅
- **Implementation**: Environment variables
- **Requirements**:
  - ✅ Server-side keys use `process.env.*` (NOT `NEXT_PUBLIC_*`)
  - ✅ Client-side public keys use `NEXT_PUBLIC_*` prefix
  - ✅ `.env.local` in `.gitignore`
  - ✅ Never commit API keys to repository
- **Current Keys**:
  - `PINATA_API_KEY` ✅ Server-side
  - `PINATA_SECRET_KEY` ✅ Server-side
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` ✅ Public
  - `GPU_SHARED_SECRET` ✅ Server-side
- **Files to Check**:
  - `frontend/.env.local` - Local environment
  - VPS `/var/www/decleanup/frontend/.env.local` - Production environment

### 5. CORS Security ⚠️ **NEEDS REVIEW**
- **Implementation**: IPFS and ML verification endpoints
- **Requirements**:
  - ⚠️ No wildcard `*` in production
  - ⚠️ Only trusted origins allowed
  - ⚠️ GPU service needs CORS configuration
- **Files to Check**:
  - `frontend/src/app/api/ipfs/upload/route.ts`
  - `frontend/src/app/api/ml-verification/verify/route.ts`
- **Action Required**: Add CORS utility and configure properly
- **Priority**: Medium

### 6. Security Headers ⚠️ **MISSING**
- **Implementation**: Next.js security headers
- **Location**: `frontend/next.config.mjs`
- **Required Headers**:
  - ⚠️ `Strict-Transport-Security` (HSTS): `max-age=31536000; includeSubDomains`
  - ⚠️ `X-Content-Type-Options`: `nosniff`
  - ⚠️ `X-Frame-Options`: `DENY`
  - ⚠️ `Referrer-Policy`: `strict-origin-when-cross-origin`
  - ⚠️ `Permissions-Policy`: Restrict APIs (camera=(), microphone=(), geolocation=())
- **Action Required**: Add security headers to `next.config.mjs`
- **Priority**: Medium

### 7. Content Security Policy (CSP) ⚠️ **MISSING**
- **Implementation**: CSP headers
- **Location**: `frontend/next.config.mjs`
- **Requirements**:
  - ⚠️ `default-src 'self'`
  - ⚠️ `script-src 'self' 'unsafe-eval' 'unsafe-inline'` (Next.js requirement)
  - ⚠️ `img-src 'self' https: data: blob: ipfs.io gateway.pinata.cloud`
  - ⚠️ `connect-src 'self' https://celo-sepolia.infura.io wss://*.walletconnect.com`
  - ⚠️ `frame-ancestors 'none'`
- **Action Required**: Configure CSP
- **Priority**: Medium

### 8. HTTPS Enforcement ⚠️ **NEEDS CONFIGURATION**
- **Implementation**: VPS HTTPS configuration
- **Requirements**:
  - ⚠️ SSL/TLS certificate for VPS domain
  - ⚠️ Nginx/Apache HTTPS redirect
  - ⚠️ HSTS header
- **Current Status**: Using IP address (207.180.203.243) - needs domain + SSL
- **Action Required**: 
  1. Configure domain name
  2. Install SSL certificate (Let's Encrypt)
  3. Configure HTTPS redirect
- **Priority**: High (before mainnet launch)

### 9. Dependency Security ⚠️ **NEEDS UPDATES**
- **Implementation**: Regular updates
- **Requirements**:
  - ✅ Regular `npm audit` checks
  - ⚠️ Next.js security vulnerability (v14.2.15 → upgrade to latest)
  - ✅ Keep dependencies updated
- **Current Vulnerabilities**: 
  - 53 vulnerabilities (38 low, 5 moderate, 7 high, 3 critical)
  - Next.js v14.2.15 has known security issues
- **Action Required**:
  ```bash
  npm audit fix
  npm update next@latest
  ```
- **Priority**: High

### 10. Wallet Connection Security ✅
- **Implementation**: RainbowKit + wagmi
- **Requirements**:
  - ✅ Secure WalletConnect integration
  - ✅ Proper chain validation
  - ✅ Transaction signing verification
  - ✅ Address validation
- **Files to Check**:
  - `frontend/src/lib/blockchain/wagmi.ts`
  - `frontend/src/lib/providers.tsx`

## 🔐 Smart Contract Security

### 11. Contract Verification ✅
- **Requirements**:
  - ✅ All contracts verified on CeloScan
  - ✅ Contract addresses documented
  - ✅ ABI files committed to repository
- **Files to Check**:
  - `contracts/scripts/deployed_addresses.json`
  - `frontend/src/lib/blockchain/contracts.ts`

### 12. Private Key Management ✅
- **Requirements**:
  - ✅ Deployer private key in `.env` (never committed)
  - ✅ Separate keys for testnet and mainnet
  - ✅ Hardware wallet for mainnet deployments
- **Files to Check**:
  - `contracts/.env` - Should be in `.gitignore`

### 13. Smart Contract Access Control ✅
- **Requirements**:
  - ✅ Role-based access control (verifier role)
  - ✅ Owner-only functions protected
  - ✅ Pause mechanism for emergencies
- **Files to Check**:
  - `contracts/contracts/Submission.sol`
  - `contracts/contracts/DCURewardManager.sol`

## 🤖 ML Verification Security

### 14. GPU Service Security ⚠️ **NEEDS IMPROVEMENT**
- **Implementation**: FastAPI service on VPS
- **Requirements**:
  - ✅ Shared secret authentication (`GPU_SHARED_SECRET`)
  - ⚠️ HTTPS connection (currently HTTP)
  - ⚠️ Rate limiting per IP
  - ⚠️ Input validation (image size, format)
  - ⚠️ Firewall rules (only accept from frontend)
- **Current Issues**:
  - GPU service runs on HTTP (port 8000)
  - No rate limiting
  - No IP whitelist
- **Action Required**:
  1. Add HTTPS (reverse proxy with Nginx)
  2. Implement rate limiting
  3. Add IP whitelist
- **Priority**: High

### 15. Image Upload Security ✅
- **Implementation**: IPFS via Pinata
- **Requirements**:
  - ✅ File size validation (10MB limit)
  - ✅ Image type validation
  - ✅ HEIC to JPEG conversion
  - ⚠️ Malicious file detection (missing)
- **Files to Check**:
  - `frontend/src/lib/blockchain/ipfs.ts`
  - `frontend/src/features/cleanup/pages/page.tsx`
- **Action Required**: Add malicious file detection (magic bytes check)
- **Priority**: Medium

## 🚀 Performance & Reliability

### 16. Error Handling ✅
- **Requirements**:
  - ✅ Graceful RPC error handling
  - ✅ IPFS gateway fallbacks
  - ✅ User-friendly error messages
  - ✅ Error logging
- **Files to Check**:
  - `frontend/src/lib/blockchain/contracts.ts`
  - `frontend/src/lib/dmrv/gpu-verification.ts`

### 17. Transaction Handling ✅
- **Requirements**:
  - ✅ Proper polling with timeout
  - ✅ Transaction confirmation
  - ✅ Retry logic for failed transactions
- **Files to Check**:
  - `frontend/src/lib/blockchain/contracts.ts`

### 18. Database/State Management ✅
- **Implementation**: On-chain state only
- **Requirements**:
  - ✅ No centralized database
  - ✅ All data on blockchain or IPFS
  - ✅ Read-only RPC calls optimized
- **Notes**: Consider Redis for caching if performance issues arise

## 🔧 Code Quality

### 19. TypeScript & Linting ✅
- **Requirements**:
  - ✅ TypeScript strict mode
  - ✅ ESLint configured
  - ✅ No TypeScript errors in production build
- **Files to Check**:
  - `frontend/tsconfig.json`
  - `contracts/tsconfig.json`
  - `frontend/package.json` (eslint config)

### 20. Testing ⚠️ **MINIMAL**
- **Requirements**:
  - ⚠️ Unit tests for critical functions
  - ⚠️ Smart contract tests
  - ⚠️ ML verification tests
- **Current Status**:
  - Some contract tests exist
  - Frontend tests minimal
- **Action Required**: Add comprehensive tests
- **Priority**: Medium

## 📋 Production Deployment Checklist

### Before Mainnet Launch:
- [ ] Node.js updated to v22.22.0+ (both local and VPS)
- [ ] Rate limiting implemented
- [ ] Input validation strengthened
- [ ] Security headers configured
- [ ] CSP headers configured
- [ ] HTTPS/SSL configured for VPS
- [ ] GPU service secured (HTTPS, rate limiting, IP whitelist)
- [ ] Next.js updated to latest version
- [ ] All dependencies updated (`npm audit fix`)
- [ ] Smart contracts audited
- [ ] ML model tested and validated
- [ ] Comprehensive testing completed
- [ ] Backup and recovery plan
- [ ] Monitoring and alerting configured

### VPS Configuration (207.180.203.243):
- [ ] Firewall configured (ufw)
  - Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8000 (GPU service - whitelist only)
  - Deny: All other ports
- [ ] SSH key-only authentication
- [ ] Fail2ban configured
- [ ] Auto-updates enabled
- [ ] Monitoring (CPU, memory, disk)
- [ ] Backup strategy
- [ ] PM2 configured with auto-restart
- [ ] Log rotation configured

### Environment Variables (Production):
```bash
# Frontend (.env.local on VPS)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL=https://celo-sepolia.infura.io/v3/...
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
GPU_INFERENCE_SERVICE_URL=http://localhost:8000
GPU_SHARED_SECRET=...
UPLOAD_DIR=/var/www/decleanup/uploads
PUBLIC_URL_BASE=http://207.180.203.243:3000

# GPU Service (.env on VPS)
SHARED_SECRET=...
MODEL_PATH=/path/to/yolov8n.pt
CONF_THRESHOLD=0.10
```

## 🚨 Critical Issues to Fix

### Priority 1 (Fix Immediately):
1. ⚠️ **Node.js v22.22.0+ update** - Security vulnerability
2. ⚠️ **Rate limiting** - Prevent abuse
3. ⚠️ **Input validation** - Prevent DoS attacks
4. ⚠️ **Next.js update** - Known security issues

### Priority 2 (Fix Before Mainnet):
5. ⚠️ **HTTPS/SSL for VPS** - Secure connections
6. ⚠️ **GPU service security** - HTTPS, rate limiting, IP whitelist
7. ⚠️ **Security headers** - CSP, HSTS, etc.

### Priority 3 (Improvements):
8. ⚠️ **Comprehensive testing** - Unit tests, integration tests
9. ⚠️ **Monitoring and alerting** - Track errors, performance
10. ⚠️ **CORS configuration** - Proper origin restrictions
11. ⚠️ **Malicious file detection** - Image upload security

## 📚 Reference Documents

- `docs/NODEJS_VULNERABILITY_FIX.md` - Node.js upgrade guide
- `docs/DEVELOPER_SPECS.md` - Complete developer documentation
- `docs/SSH_TROUBLESHOOTING.md` - VPS access and troubleshooting
- `docs/AI_VERIFICATION_CHANGES_v2026-01-15.md` - ML verification updates
- `docs/HYPERCERTS_DEVELOPER_RESPONSE.md` - Hypercerts implementation
- `docs/FIXES_APPLIED.md` - Recent fixes and improvements

## 🔗 External Resources

- [Node.js Security Release](https://nodejs.org/en/blog/vulnerability/january-2026-dos-mitigation-async-hooks)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Celo Security Best Practices](https://docs.celo.org/developer/security)
- [Smart Contract Security](https://consensys.github.io/smart-contract-best-practices/)

---

**Last Updated**: January 16, 2026  
**Version**: 1.0  
**Status**: ⚠️ Multiple critical issues require attention before mainnet launch
