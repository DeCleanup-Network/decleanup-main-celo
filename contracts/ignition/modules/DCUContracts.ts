import {
  buildModule,
  ModuleBuilder,
} from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying core DeCleanup contracts (participation ledger + submissions).
 *
 * Order:
 * 1. DCURewardManager (Impact NFT address filled after impact NFT deploy)
 * 2. ImpactProductNFT(rewardManager)
 * 3. DCURewardManager.updateNftCollection(impactProductNFT)
 * 4. Submission(rewardManager, defaultRewardWei)
 *
 * Fungible $cDCU uses CDCUToken + ClaimVault (deploy-cdcu.ts), not DCUToken.
 */
export default buildModule("DCUContracts", (m: ModuleBuilder) => {
  const impactProductNFTPlaceholder = "0x0000000000000000000000000000000000000000";

  const dcuRewardManager = m.contract("DCURewardManager", [impactProductNFTPlaceholder]);

  const impactProductNFT = m.contract("ImpactProductNFT", [dcuRewardManager]);

  m.call(dcuRewardManager, "updateNftCollection", [impactProductNFT]);

  const submission = m.contract("Submission", [
    dcuRewardManager,
    "10000000000000000000",
  ]);

  return {
    dcuRewardManager,
    impactProductNFT,
    submission,
  };
});
