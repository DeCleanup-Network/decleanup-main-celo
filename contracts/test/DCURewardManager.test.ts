import { expect } from "chai";
import hre from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("DCURewardManager", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2, user3] = await hre.viem.getWalletClients();

    const dcuRewardManager = await hre.viem.deployContract("DCURewardManager", [
      "0x0000000000000000000000000000000000000000",
    ]);

    const impactProductNft = await hre.viem.deployContract(
      "ImpactProductNFT",
      [dcuRewardManager.address]
    );

    await dcuRewardManager.write.updateNftCollection([impactProductNft.address], {
      account: owner.account,
    });

    await impactProductNft.write.setRewardsContract([dcuRewardManager.address], {
      account: owner.account,
    });

    return {
      dcuRewardManager,
      impactProductNft,
      owner,
      user1,
      user2,
      user3
    };
  }

  //
  // Impact Product Rewards
  //
  describe("Impact Product Claim Rewards", function () {

    it("Should not reward if PoI is not verified", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      try {
        await dcuRewardManager.write.rewardImpactProductClaim(
          [user1.account.address, 1n],
          { account: owner.account }
        );
        expect.fail("Expected revert but function succeeded");
      } catch (err: any) {
        expect(err.message).to.include("User not eligible for rewards");
      }
    });

    it("Should reward after PoI verification and user mints NFT (safeMint)", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } =
        await loadFixture(deployContractsFixture);

      await impactProductNft.write.verifyPOI(
        [user1.account.address],
        { account: owner.account }
      );

      await impactProductNft.write.mint(
        [user1.account.address],
        { account: owner.account }
      );

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user1.account.address, 1n],
        { account: owner.account }
      );

      const balance = await dcuRewardManager.read.getBalance([
        user1.account.address
      ]);

      expect(balance).to.equal(10n * 10n ** 18n);
    });

    it("Should prevent duplicate rewards for same level", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } =
        await loadFixture(deployContractsFixture);

      await impactProductNft.write.verifyPOI(
        [user1.account.address],
        { account: owner.account }
      );

      await impactProductNft.write.mint(
        [user1.account.address],
        { account: owner.account }
      );

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user1.account.address, 1n],
        { account: owner.account }
      );

      try {
        await dcuRewardManager.write.rewardImpactProductClaim(
          [user1.account.address, 1n],
          { account: owner.account }
        );
        expect.fail("Expected revert but function succeeded");
      } catch (err: any) {
        expect(err.message).to.include("Level already claimed");
      }
    });
  });

  //
  // PoI Streak
  //
  describe("PoI Streak Rewards", function () {
    it("Should not reward first verification", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address
      ]);
      expect(bal).to.equal(0n);
    });

    it("Should reward streak within 7 days", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await time.increase(6 * 24 * 60 * 60);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address
      ]);
      expect(bal).to.equal(3n * 10n ** 18n);
    });

    it("Should break streak after 7 days", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await time.increase(8 * 24 * 60 * 60);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address
      ]);
      expect(bal).to.equal(0n);
    });
  });

  //
  // Referral rewards
  //
  describe("Referral Rewards", function () {
    it("Should register referral", async function () {
      const { dcuRewardManager, user1, user2, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.registerReferral(
        [user2.account.address, user1.account.address],
        { account: owner.account }
      );

      const ref = (await dcuRewardManager.read.getReferrer([
        user2.account.address
      ])) as unknown as string;

      expect(ref.toLowerCase()).to.equal(user1.account.address.toLowerCase());
    });

    it("Should reward referrer when invitee claims level", async function () {
      const { dcuRewardManager, impactProductNft, user1, user2, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.registerReferral(
        [user2.account.address, user1.account.address],
        { account: owner.account }
      );

      await impactProductNft.write.verifyPOI(
        [user2.account.address],
        { account: owner.account }
      );

      await impactProductNft.write.mint(
        [user2.account.address],
        { account: owner.account }
      );

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user2.account.address, 1n],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address
      ]);

      // CORRIGIDO: 3 * 1e18
      expect(bal).to.equal(3n * 10n ** 18n);
    });
  });

  //
  // Claiming
  //
  describe("Impact report vs recyclables buckets", function () {
    it("Should accrue separate balances for rewardImpactReports and rewardRecyclables", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.rewardImpactReports(
        [user1.account.address, 1n],
        { account: owner.account }
      );
      await dcuRewardManager.write.rewardRecyclables(
        [user1.account.address, 1n],
        { account: owner.account }
      );

      const stats = (await dcuRewardManager.read.getUserRewardStats([
        user1.account.address,
      ])) as {
        impactReportRewardsAmount: bigint;
        recyclablesRewardsAmount: bigint;
      };

      expect(stats.impactReportRewardsAmount).to.equal(5n * 10n ** 18n);
      expect(stats.recyclablesRewardsAmount).to.equal(5n * 10n ** 18n);

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(bal).to.equal(10n * 10n ** 18n);
    });
  });

  describe("Ledger (no ERC-20 mint from reward manager)", function () {
    it("Should keep accrued balance on-chain until $cDCU is claimed via ClaimVault off-chain flow", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } =
        await loadFixture(deployContractsFixture);

      await impactProductNft.write.verifyPOI([user1.account.address], {
        account: owner.account,
      });

      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.rewardImpactProductClaim([user1.account.address, 1n], {
        account: owner.account,
      });

      const bal = await dcuRewardManager.read.getBalance([user1.account.address]);
      expect(bal).to.equal(10n * 10n ** 18n);
    });
  });
});
