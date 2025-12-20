import {
  buildModule,
  ModuleBuilder,
} from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, toBytes } from "viem";

/**
 * Ignition module for deploying all DCU contracts
 * 
 * Deployment order:
 * 1. DCUToken - ERC20 token with minter role
 * 2. DCURewardManager - Manages reward distribution
 * 3. ImpactProductNFT - ERC721 NFT for impact products
 * 4. Submission - Handles cleanup submissions and verification
 * 5. RecyclablesReward - Optional, deployed separately (see scripts/)
 */
export default buildModule("DCUContracts", (m: ModuleBuilder) => {
  // Deploy the DCU token first
  const dcuToken = m.contract("DCUToken");

  // Deploy the ImpactProductNFT contract first (needed for DCURewardManager)
  // We'll use a placeholder address initially, then update it
  const impactProductNFTPlaceholder = "0x0000000000000000000000000000000000000000";
  
  // Deploy the DCURewardManager contract with DCUToken and placeholder NFT address
  const dcuRewardManager = m.contract("DCURewardManager", [
    dcuToken,
    impactProductNFTPlaceholder,
  ]);

  // Grant the MINTER_ROLE to the DCURewardManager contract
  // MINTER_ROLE = keccak256("MINTER_ROLE")
  const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));
  m.call(dcuToken, "grantRole", [
    MINTER_ROLE,
    dcuRewardManager,
  ]);

  // Deploy the ImpactProductNFT contract with DCURewardManager address
  const impactProductNFT = m.contract("ImpactProductNFT", [dcuRewardManager]);

  // Update DCURewardManager with ImpactProductNFT address
  m.call(dcuRewardManager, "updateNftCollection", [impactProductNFT]);

  // Deploy the Submission contract
  const submission = m.contract("Submission", [
    dcuToken,
    dcuRewardManager,
    "10000000000000000000", // 10 DCU default reward (in wei)
  ]);

  // Return all deployed contracts
  return {
    dcuToken,
    dcuRewardManager,
    impactProductNFT,
    submission,
  };
});
