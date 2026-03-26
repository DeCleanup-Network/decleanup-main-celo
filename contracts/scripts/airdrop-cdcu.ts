import hardhat from "hardhat";

async function main() {
  console.log("Starting cDCU airdrop...");

  const { ethers } = hardhat as any;

  // Get the deployed DCUToken address from environment or config
  const dcuTokenAddress = process.env.DCU_TOKEN_ADDRESS;
  if (!dcuTokenAddress) {
    throw new Error("DCU_TOKEN_ADDRESS not set");
  }

  // Airdrop recipients - V1 users and testnet participants
  const recipients = [
    // V1 users - replace with actual addresses
    { address: "0x...", amount: ethers.parseEther("100") },
    // Add more addresses as needed
  ];

  // Get contract instance
  const DCUToken = await ethers.getContractFactory("DCUToken");
  const dcuToken = DCUToken.attach(dcuTokenAddress);

  console.log(`Airdropping to ${recipients.length} recipients...`);

  for (const recipient of recipients) {
    console.log(`Airdropping ${ethers.formatEther(recipient.amount)} cDCU to ${recipient.address}`);
    // Since script runs as deployer who has MINTER_ROLE, can mint directly
    const tx = await dcuToken.mint(recipient.address, recipient.amount);
    await tx.wait();
    console.log(`✅ Airdropped to ${recipient.address}`);
  }

  console.log("Airdrop completed successfully!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});