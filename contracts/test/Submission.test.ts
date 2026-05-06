import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const { expect } = chai;

import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, zeroAddress } from "viem";

describe("Submission", function () {
  async function deployFixture() {
    const [owner, user, admin] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const rewardManager = await hre.viem.deployContract("DCURewardManager", [zeroAddress]);

    const defaultReward = parseEther("10");

    const submission = await hre.viem.deployContract("Submission", [
      rewardManager.address,
      defaultReward,
    ]);

    await rewardManager.write.setSubmissionContract(
      [submission.address],
      { account: owner.account }
    );

    // --- IMPORTANT: grant VERIFIER_ROLE to admin (new requirement)
    const VERIFIER_ROLE = await submission.read.VERIFIER_ROLE();
    await submission.write.grantRole(
      [VERIFIER_ROLE, admin.account.address],
      { account: owner.account }
    );

    // And admin role too (unchanged)
    const ADMIN_ROLE = await submission.read.ADMIN_ROLE();
    await submission.write.grantRole(
      [ADMIN_ROLE, admin.account.address],
      { account: owner.account }
    );

    await submission.write.updateSubmissionFee(
      [0n, false],
      { account: admin.account }
    );

    return {
      owner,
      user,
      admin,
      rewardManager,
      submission,
      publicClient,
    };
  }

  const defaultArgs = {
    dataURI: "ipfs://QmTest123",
    beforePhotoHash: "ipfs://before",
    afterPhotoHash: "ipfs://after",
    impactFormDataHash: "",
    lat: 0,
    lng: 0,
    referrer: zeroAddress,
  };

  const buildArgs = (overrides: Partial<typeof defaultArgs> = {}) => {
    const p = { ...defaultArgs, ...overrides };
    return [
      p.dataURI,
      p.beforePhotoHash,
      p.afterPhotoHash,
      p.impactFormDataHash,
      p.lat,
      p.lng,
      p.referrer,
    ] as const;
  };

  //
  // Tests
  //
  describe("Submission Creation", function () {
    it("Should create a submission", async function () {
      const { submission, user } = await loadFixture(deployFixture);

      await submission.write.createSubmission(buildArgs(), {
        account: user.account,
      });

      const count = await submission.read.submissionCount();
      expect(count).to.equal(1n);

      const userSubs = (await submission.read.getSubmissionsByUser([
        user.account.address,
      ])) as bigint[];

      expect(userSubs.length).to.equal(1);
      expect(userSubs[0]).to.equal(0n);
    });

    it("Should reject empty dataURI", async function () {
      const { submission, user } = await loadFixture(deployFixture);

      await expect(
        submission.write.createSubmission(buildArgs({ dataURI: "" }), {
          account: user.account,
        })
      ).to.be.rejectedWith("SUBMISSION__InvalidSubmissionData");
    });
  });

  describe("Submission Approval", function () {
    it("Should approve and reward verifier (submitter DCU accrues via NFT / bonus paths, not at approve)", async function () {
      const { submission, user, admin, rewardManager } =
        await loadFixture(deployFixture);

      await submission.write.createSubmission(buildArgs(), {
        account: user.account,
      });

      const initialUser = await rewardManager.read.getBalance([user.account.address]);
      expect(initialUser).to.equal(0n);

      await submission.write.approveSubmission([0n], {
        account: admin.account, // MUST be VERIFIER
      });

      const userAfter = await rewardManager.read.getBalance([user.account.address]);
      expect(userAfter).to.equal(0n);

      const verifierBal = await rewardManager.read.getBalance([admin.account.address]);
      expect(verifierBal).to.equal(parseEther("1"));
    });

    it("Should prevent non-verifier from approving", async function () {
      const { submission, user } = await loadFixture(deployFixture);

      await submission.write.createSubmission(buildArgs(), {
        account: user.account,
      });

      await expect(
        submission.write.approveSubmission([0n], {
          account: user.account,
        })
      ).to.be.rejectedWith("AccessControl");
    });
  });

  describe("Submission Rejection", function () {
    it("Should reject submission", async function () {
      const { submission, user, admin, rewardManager } =
        await loadFixture(deployFixture);

      await submission.write.createSubmission(buildArgs(), {
        account: user.account,
      });

      await submission.write.rejectSubmission([0n], {
        account: admin.account, // VERIFIER
      });

      const claimable = await rewardManager.read.getBalance([
        user.account.address,
      ]);
      expect(claimable).to.equal(0n);
    });
  });

  describe("Configuration", function () {
    it("Should update default reward", async function () {
      const { submission, owner } = await loadFixture(deployFixture);

      const initial = await submission.read.defaultRewardAmount();
      expect(initial).to.equal(parseEther("10"));

      await submission.write.updateDefaultReward([parseEther("20")], {
        account: owner.account,
      });

      const updated = await submission.read.defaultRewardAmount();
      expect(updated).to.equal(parseEther("20"));
    });
  });
});
