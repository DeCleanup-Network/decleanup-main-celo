# DeCleanup Network (Celo)

DeCleanup Network’s Celo-native stack for turning verified cleanups into onchain **Impact Products**, **Hypercerts**, and token-based rewards.

This repository contains the **main web application** (dashboard, profile, cleanup, verifier, leaderboard) together with the blockchain integration layer used to tokenize environmental impact and distribute $DCU / cRECY incentives.

---

## Table of Contents

- [Overview](#overview)
- [What’s Ready](#whats-ready)
- [What’s Intentionally Scoped (MVP)](#whats-intentionally-scoped-mvp)
- [Repo Layout](#repo-layout)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Deployment Status](#deployment-status)
- [Known Limitations](#known-limitations)
- [Docs](#docs)

---

## Overview

The goal of this app is to make environmental cleanup verifiable, composable, and rewardable onchain.

Users submit cleanups with photo proof and impact data.  
Verifiers approve or reject submissions.  
Approved cleanups unlock rewards, levels, and future Hypercert minting.

This repo represents a **stable MVP frontend** aligned with the current contract surface and ready for production deployment.

---

## What’s Ready

### Frontend

- **Next.js 16 (App Router)** with strict TypeScript enabled
- **Dashboard / Profile**
  - Personal stats (DCU balance, streak, level)
  - Impact Product preview (MVP-safe, NFT optional)
  - Claim actions gated by verification state
- **Cleanup Submission Flow**
  - Before / after photos
  - Location capture
  - Optional impact form (weight, area, time, waste types)
- **Verifier Interface**
  - Review pending cleanups
  - Approve or reject submissions
  - Explicit single-cleanup-at-a-time flow (MVP constraint)
- **Leaderboard**
  - Top users by total DCU
  - Cleanup counts
  - Optional country inference via reverse geocoding
- **Sharing & Referrals**
  - Wallet-based referral links
  - Share-ready URLs (main app)
- **Build Stability**
  - Frontend builds cleanly with strict type checks
  - No runtime assumptions about non-existent contracts

---

### Blockchain Integration (Frontend Layer)

- All blockchain calls are centralized under `lib/blockchain/`
- Clear separation between:
  - **Live contract reads**
  - **MVP stubs** (for features not yet deployed)
- Supported flows:
  - Cleanup submission
  - Verification (approve / reject)
  - Reward claiming
  - User level resolution
- Explicit fallback behavior when contracts or addresses are missing

---

## What’s Intentionally Scoped (MVP)

The following features are **intentionally stubbed or disabled** to avoid half-working flows:

- Impact Product NFT minting (tokenId may be `null`)
- Hypercert minting & claiming
- Historical chain scanning (only active cleanup is tracked)
- Staking mechanics
- Multi-cleanup claim batching

These will be enabled incrementally once contracts and indexing are finalized.

---

## Repo Layout

