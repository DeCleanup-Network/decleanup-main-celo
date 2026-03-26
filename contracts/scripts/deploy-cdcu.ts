/**
 * Deploy $cDCU token (CDCUToken) and ClaimVault.
 *
 * Order: 1) CDCUToken  2) ClaimVault(token, authorizedSigner)  3) CDCUToken.setClaimVault(ClaimVault)
 *
 * Required env:
 *   AUTHORIZED_SIGNER_ADDRESS - Backend wallet that will sign EIP-712 claim authorizations
 *
 * Optional env:
 *   CLAIMVAULT_OWNER_MULTISIG - If set, ClaimVault ownership is transferred to this address (2-of-3 multisig recommended)
 *
 * Usage:
 *   AUTHORIZED_SIGNER_ADDRESS=0x... npx hardhat run scripts/deploy-cdcu.ts --network celo
 *   AUTHORIZED_SIGNER_ADDRESS=0x... npx hardhat run scripts/deploy-cdcu.ts --network celoSepolia
 */

import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const authorizedSigner = process.env.AUTHORIZED_SIGNER_ADDRESS;
  if (!authorizedSigner || authorizedSigner === "0x0000000000000000000000000000000000000000") {
    console.error("❌ AUTHORIZED_SIGNER_ADDRESS env is required (backend wallet for EIP-712 claim signing)");
    process.exit(1);
  }

  const [deployer] = await hre.viem.getWalletClients();
  if (!deployer) {
    console.error("❌ No wallet client (connect signer for the network)");
    process.exit(1);
  }

  console.log("Deploying $cDCU (CDCUToken) + ClaimVault...\n");
  console.log("   Deployer:", deployer.account.address);
  console.log("   Authorized signer (backend):", authorizedSigner);

  // 1. Deploy CDCUToken
  const cdcuToken = await hre.viem.deployContract("CDCUToken", [], {
    account: deployer.account,
  });
  console.log("\n✅ CDCUToken deployed:", cdcuToken.address);

  // 2. Deploy ClaimVault
  const claimVault = await hre.viem.deployContract(
    "ClaimVault",
    [cdcuToken.address, authorizedSigner as `0x${string}`],
    { account: deployer.account }
  );
  console.log("✅ ClaimVault deployed:", claimVault.address);

  // 3. Set ClaimVault as the only minter on CDCUToken (one-time, irreversible)
  const tokenWithSigner = await hre.viem.getContractAt("CDCUToken", cdcuToken.address, {
    walletClient: deployer,
  });
  await tokenWithSigner.write.setClaimVault([claimVault.address as `0x${string}`]);
  console.log("✅ CDCUToken.setClaimVault(ClaimVault) done");

  // 4. Optional: transfer ClaimVault ownership to multisig
  const multisigOwner = process.env.CLAIMVAULT_OWNER_MULTISIG;
  if (multisigOwner && multisigOwner !== "0x0000000000000000000000000000000000000000") {
    const vaultWithSigner = await hre.viem.getContractAt("ClaimVault", claimVault.address, {
      walletClient: deployer,
    });
    await vaultWithSigner.write.transferOwnership([multisigOwner as `0x${string}`]);
    console.log("✅ ClaimVault ownership transferred to multisig:", multisigOwner);
  } else {
    console.log("   (ClaimVault owner remains deployer; set CLAIMVAULT_OWNER_MULTISIG to transfer to multisig)");
  }

  let chainId: number | undefined;
  try {
    const client = hre.viem.getPublicClient();
    chainId = typeof (client as any).getChainId === "function" ? await (client as any).getChainId() : undefined;
  } catch {
    chainId = (hre.network.config as any)?.chainId;
  }
  const out = {
    CDCUToken: cdcuToken.address,
    ClaimVault: claimVault.address,
    authorizedSigner,
    chainId: chainId ?? 0,
    network: hre.network.name,
  };
  const outPath = path.join(__dirname, "cdcu-deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\n📄 Addresses written to", outPath);
  console.log("\nNext steps:");
  console.log("   1. Set frontend env: NEXT_PUBLIC_CLAIMVAULT_ADDRESS=" + claimVault.address);
  console.log("   2. Backend: CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY (key for " + authorizedSigner + "), optional CLAIM_VAULT_ISSUED_STORE_PATH");
  console.log("   3. Eligibility (50 DCU points) and multiplier formula are backend-only; see docs/TOKEN_SPEC.md and frontend/src/lib/cdcu/claim-signing.ts");
  console.log("   4. When LP is ready: ClaimVault.mintLiquidityTo(lpContract) (owner, one-time).");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
