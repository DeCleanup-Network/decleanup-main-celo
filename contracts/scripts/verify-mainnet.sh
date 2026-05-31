#!/usr/bin/env bash
# Verify all mainnet contracts on Celoscan (Etherscan V2 unified API).
#
# Prerequisites:
#   - Root .env has CELOSCAN_API_KEY set to a valid Etherscan.io V2 API key
#     (NOT a celoscan.io-only key — V2 requires the unified key from etherscan.io)
#   - You've waited at least 15 min after the last rate-limit hit
#
# Usage (from repo root):
#   bash contracts/scripts/verify-mainnet.sh
#
# Or just verify one contract first to test the API key:
#   bash contracts/scripts/verify-mainnet.sh cdcu

set -uo pipefail

NETWORK="celo"

# Mainnet addresses (lowercase or checksum both fine for hardhat-verify)
DCU_REWARD_MANAGER="0x1936270b066ebadedc2d84f4ce3b488729d1d638"
IMPACT_PRODUCT_NFT="0x97fa526fba91f01b5a4e0f25c71751e474cb6f45"
SUBMISSION="0x2f3654f0ad8117c41185c589dcd0ea22522fe5af"
LEGACY_SUBMISSION="0xc6523bf318e39b6d9dfbcd95aed9d5c3c5d041d1"
LEGACY_IMPACT_PRODUCT_NFT="0xc6a7ec8b1695023d3ee74adc29972cd341aba3ea"
CDCU_TOKEN="0x34d66e9552e9dc23a24eca13bb1f8f71f4b9bfc1"
CLAIM_VAULT="0x4f69a1170c8799b5bc1587275b2e7da5a8406ff0"

# Constructor args used at deploy time (NOT current linked state)
ZERO_ADDRESS="0x0000000000000000000000000000000000000000"
DEFAULT_REWARD_WEI="10000000000000000000"   # 10 DCU in wei
AUTHORIZED_SIGNER="0x5f312ce61bE088336A441aD21e1e1FB7Cb837e13"

target="${1:-all}"

run() {
  local label="$1"
  shift
  echo
  echo "=== Verifying ${label} ==="
  npx hardhat verify --network "${NETWORK}" "$@" || echo "[${label}] failed (continuing)"
}

case "$target" in
  cdcu)
    run "CDCUToken" "${CDCU_TOKEN}"
    ;;
  rewardmanager|reward)
    run "DCURewardManager" "${DCU_REWARD_MANAGER}" "${ZERO_ADDRESS}"
    ;;
  impact|nft)
    run "ImpactProductNFT" "${IMPACT_PRODUCT_NFT}" "${DCU_REWARD_MANAGER}"
    ;;
  submission)
    run "Submission" "${SUBMISSION}" "${DCU_REWARD_MANAGER}" "${DEFAULT_REWARD_WEI}"
    ;;
  vault|claim)
    run "ClaimVault" "${CLAIM_VAULT}" "${CDCU_TOKEN}" "${AUTHORIZED_SIGNER}"
    ;;
  all)
    run "CDCUToken"          "${CDCU_TOKEN}"
    run "DCURewardManager"   "${DCU_REWARD_MANAGER}" "${ZERO_ADDRESS}"
    run "ImpactProductNFT"   "${IMPACT_PRODUCT_NFT}" "${DCU_REWARD_MANAGER}"
    run "Submission"         "${SUBMISSION}"        "${DCU_REWARD_MANAGER}" "${DEFAULT_REWARD_WEI}"
    run "ClaimVault"         "${CLAIM_VAULT}"       "${CDCU_TOKEN}" "${AUTHORIZED_SIGNER}"
    ;;
  *)
    echo "Unknown target: ${target}"
    echo "Valid: all | cdcu | rewardmanager | impact | submission | vault"
    exit 1
    ;;
esac

echo
echo "Done."
