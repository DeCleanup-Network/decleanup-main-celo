import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expectRevert } from "./helpers/setup";

describe("Input Validation", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();

    const rewardManager = await hre.viem.deployContract("DCURewardManager", [
      "0x0000000000000000000000000000000000000000",
    ]);
    const impactProductNft = await hre.viem.deployContract("ImpactProductNFT", [
      rewardManager.address,
    ]);
    await rewardManager.write.updateNftCollection([impactProductNft.address], {
      account: owner.account,
    });

    await impactProductNft.write.setRewardsContract([rewardManager.address], {
      account: owner.account,
    });

    await impactProductNft.write.verifyPOI([user1.account.address], {
      account: owner.account,
    });
    await rewardManager.write.setPoiVerificationStatus(
      [user1.account.address, true],
      { account: owner.account }
    );

    return { rewardManager, impactProductNft, owner, user1, user2 };
  }

  describe("ImpactProductNFT Input Validation", function () {
    it("Should reject updateImpactLevel with invalid impact level", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployContractsFixture);

      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });
      const tokenId = 0n;

      await expectRevert(
        impactProductNft.simulate.updateImpactLevel([tokenId, 0n], {
          account: owner.account,
        }),
        "Invalid impact level range"
      );

      const MAX_LEVEL = 10n;
      await expectRevert(
        impactProductNft.simulate.updateImpactLevel([tokenId, MAX_LEVEL + 1n], {
          account: owner.account,
        }),
        "Invalid impact level range"
      );

      await impactProductNft.write.updateImpactLevel([tokenId, 5n], {
        account: owner.account,
      });
    });
  });
});
