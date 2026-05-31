import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const { expect } = chai;

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, zeroAddress } from "viem";

describe("Combined transaction flows", function () {
  async function deployLinkedFixture() {
    const [owner, user, admin] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const rewardManager = await hre.viem.deployContract("DCURewardManager", [zeroAddress]);
    const impactNft = await hre.viem.deployContract("ImpactProductNFT", [rewardManager.address]);
    const submission = await hre.viem.deployContract("Submission", [
      rewardManager.address,
      parseEther("10"),
    ]);

    await rewardManager.write.setSubmissionContract([submission.address], {
      account: owner.account,
    });
    await rewardManager.write.updateNftCollection([impactNft.address], {
      account: owner.account,
    });
    await impactNft.write.setRewardsContract([rewardManager.address], {
      account: owner.account,
    });
    await submission.write.setImpactProductNFT([impactNft.address], {
      account: owner.account,
    });
    await impactNft.write.setSubmissionContract([submission.address], {
      account: owner.account,
    });

    const VERIFIER_ROLE = await submission.read.VERIFIER_ROLE();
    await submission.write.grantRole([VERIFIER_ROLE, admin.account.address], {
      account: owner.account,
    });

    return { owner, user, admin, rewardManager, submission, impactNft, publicClient };
  }

  const baseArgs = {
    dataURI: "ipfs://QmTest123",
    beforePhotoHash: "ipfs://before",
    afterPhotoHash: "ipfs://after",
    impactFormDataHash: "ipfs://impact",
    lat: 0,
    lng: 0,
    referrer: zeroAddress,
  };

  describe("createSubmissionWithRecyclables", function () {
    it("creates submission with recyclables in one transaction", async function () {
      const { submission, user } = await loadFixture(deployLinkedFixture);

      await submission.write.createSubmissionWithRecyclables(
        [
          baseArgs.dataURI,
          baseArgs.beforePhotoHash,
          baseArgs.afterPhotoHash,
          baseArgs.impactFormDataHash,
          baseArgs.lat,
          baseArgs.lng,
          baseArgs.referrer,
          "ipfs://recyclables-photo",
          "ipfs://recyclables-receipt",
        ],
        { account: user.account }
      );

      const details = await submission.read.getSubmissionDetails([0n]);
      expect(details.hasRecyclables).to.equal(true);
      expect(details.recyclablesPhotoHash).to.equal("ipfs://recyclables-photo");
      expect(details.hasImpactForm).to.equal(true);
    });
  });

  describe("ImpactProduct mint/upgrade with bonus claim", function () {
    it("mints and claims submission bonus in one transaction", async function () {
      const { submission, impactNft, user, admin, rewardManager } =
        await loadFixture(deployLinkedFixture);

      await submission.write.createSubmissionWithRecyclables(
        [
          baseArgs.dataURI,
          baseArgs.beforePhotoHash,
          baseArgs.afterPhotoHash,
          baseArgs.impactFormDataHash,
          baseArgs.lat,
          baseArgs.lng,
          baseArgs.referrer,
          "ipfs://recyclables-photo",
          "",
        ],
        { account: user.account }
      );

      await submission.write.approveSubmission([0n], { account: admin.account });

      const statsBefore = await rewardManager.read.getUserRewardStats([user.account.address]);
      expect(statsBefore.impactReportRewardsAmount).to.equal(0n);
      expect(statsBefore.recyclablesRewardsAmount).to.equal(0n);

      await impactNft.write.safeMintWithBonus([0n], { account: user.account });

      const statsAfter = await rewardManager.read.getUserRewardStats([user.account.address]);
      expect(statsAfter.impactReportRewardsAmount).to.equal(parseEther("5"));
      expect(statsAfter.recyclablesRewardsAmount).to.equal(parseEther("5"));

      const claimed = await submission.read.bonusRewardsClaimed([0n]);
      expect(claimed).to.equal(true);
    });

    it("rejects bonus claim callback from non-NFT caller", async function () {
      const { submission, user, admin } = await loadFixture(deployLinkedFixture);

      await submission.write.createSubmission(
        [
          baseArgs.dataURI,
          baseArgs.beforePhotoHash,
          baseArgs.afterPhotoHash,
          baseArgs.impactFormDataHash,
          baseArgs.lat,
          baseArgs.lng,
          baseArgs.referrer,
        ],
        { account: user.account }
      );
      await submission.write.approveSubmission([0n], { account: admin.account });

      await expect(
        submission.write.claimSubmissionBonusRewardsFromImpactProduct(
          [user.account.address, 0n],
          { account: user.account }
        )
      ).to.be.rejectedWith("SUBMISSION__Unauthorized");
    });
  });
});
