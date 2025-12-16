import {
  buildModule,
  ModuleBuilder,
} from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, toBytes } from "viem";

/**
 * Ignition module for deploying all DCU contracts
 */
export default buildModule("DCUContracts", (m: ModuleBuilder) => {
  // Deploy the DCUStorage contract first
  const dcuStorage = m.contract("DCUStorage");

  // Deploy the DCUAccounting contract with DCUStorage address
  const dcuAccounting = m.contract("DCUAccounting", [dcuStorage]);

  // Deploy the NFTCollection contract
  const nftCollection = m.contract("NFTCollection");

  // Deploy the DCU token
  const dcuToken = m.contract("DCUToken");

  // Deploy the DCURewardManager contract with DCUToken address
  const dcuRewardManager = m.contract("DCURewardManager", [
    dcuToken,
    nftCollection,
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

  // Deploy the Submission contract
  const submission = m.contract("Submission", [
    dcuToken,
    dcuRewardManager,
    "10000000000000000000", // 10 DCU default reward (in wei)
  ]);

  // Return all deployed contracts
  return {
    dcuStorage,
    dcuAccounting,
    nftCollection,
    dcuToken,
    dcuRewardManager,
    impactProductNFT,
    submission,
  };
});
