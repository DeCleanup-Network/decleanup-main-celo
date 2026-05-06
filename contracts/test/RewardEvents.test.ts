import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { parseEther } from "viem";

describe("Reward Events", function () {
  async function deployContractsFixture() {
    const [deployer, user1, user2] = await hre.viem.getWalletClients();
    const deployerAddress = deployer.account.address;
    const user1Address = user1.account.address;
    const user2Address = user2.account.address;

    const dcuRewardManager = await hre.viem.deployContract("DCURewardManager", [
      "0x0000000000000000000000000000000000000000",
    ]);
    const impactProductNft = await hre.viem.deployContract("ImpactProductNFT", [
      dcuRewardManager.address,
    ]);
    await dcuRewardManager.write.updateNftCollection([impactProductNft.address], {
      account: deployer.account,
    });
    await impactProductNft.write.setRewardsContract([dcuRewardManager.address], {
      account: deployer.account,
    });

    await dcuRewardManager.write.setPoiVerificationStatus([user1Address, true], {
      account: deployer.account,
    });

    // Set reward eligibility for the user
    await dcuRewardManager.write.setRewardEligibilityForTesting([user1Address, true], {
      account: deployer.account,
    });

    return { dcuRewardManager, deployer, user1, user2 };
  }

  it("should deploy all contracts successfully and verify events", async function () {
    const { dcuRewardManager, deployer, user1, user2 } = await loadFixture(deployContractsFixture);
    const deployerAddress = deployer.account.address;
    const user1Address = user1.account.address;
    const user2Address = user2.account.address;
    const publicClient = await hre.viem.getPublicClient();

    const impactProductEventPromise = new Promise((resolve) => {
      const unwatch = publicClient.watchContractEvent({
        address: dcuRewardManager.address,
        abi: dcuRewardManager.abi,
        eventName: "DCURewardImpactProduct",
        onLogs: (logs) => {
          unwatch();
          resolve(logs[0]);
        },
      });
    });

    await dcuRewardManager.write.rewardImpactProductClaim([user1Address, 1n], {
      account: deployer.account,
    });

    const impactProductEvent = (await impactProductEventPromise) as any;

    expect(impactProductEvent.eventName).to.equal("DCURewardImpactProduct");
    expect(impactProductEvent.args.user.toLowerCase()).to.equal(
      user1Address.toLowerCase()
    );
    expect(impactProductEvent.args.level).to.equal(1n);
  });
});
