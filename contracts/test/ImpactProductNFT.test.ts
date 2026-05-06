import { chai, expect, expectRevert } from "./helpers/setup";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ImpactProductNFT", function () {
  async function deployImpactProductNFTFixture() {
    const [owner, user1, user2, rewardsContractOwner] =
      await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const dcuRewardManager = await hre.viem.deployContract("DCURewardManager", [
      "0x0000000000000000000000000000000000000000",
    ]);

    // Deploy the ImpactProductNFT contract with the rewards contract address
    const impactProductNft = await hre.viem.deployContract("ImpactProductNFT", [
      dcuRewardManager.address,
    ]);

    // Update the NFT collection address in DCURewardManager
    await dcuRewardManager.write.updateNftCollection([impactProductNft.address], {
      account: owner.account,
    });

    // Set the rewards contract in ImpactProductNFT to DCURewardManager
    await impactProductNft.write.setRewardsContract([dcuRewardManager.address], {
      account: owner.account,
    });

    // Verify POI for user1
    await impactProductNft.write.verifyPOI([user1.account.address], {
      account: owner.account,
    });

    return {
      impactProductNft,
      dcuRewardManager,
      owner,
      user1,
      user2,
      rewardsContractOwner,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { impactProductNft } = await loadFixture(deployImpactProductNFTFixture);

      expect(await impactProductNft.read.name()).to.equal("Impact Product NFT");
      expect(await impactProductNft.read.symbol()).to.equal("IMPACT");
    });

    it("Should set the correct owner", async function () {
      const { impactProductNft, owner } = await loadFixture(deployImpactProductNFTFixture);

      const contractOwner = await impactProductNft.read.owner();
      expect(contractOwner.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });

    it("Should initialize token counter to zero", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to check if the counter starts from 0
      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      // Check if the token ID is 0
      const tokenOwner = await impactProductNft.read.ownerOf([0n]);
      expect(tokenOwner.toLowerCase()).to.equal(user1.account.address.toLowerCase());
    });
  });

  describe("POI Verification", function () {
    it("Should allow owner to verify a POI", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      await impactProductNft.write.verifyPOI([user1.account.address], {
        account: owner.account,
      });

      expect(await impactProductNft.read.verifiedPOI([user1.account.address]))
        .to.be.true;
    });

    it("Should emit POIVerified event when verifying a POI", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      const tx = await impactProductNft.write.verifyPOI(
        [user1.account.address],
        {
          account: owner.account,
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("Should prevent non-owners from verifying a POI", async function () {
      const { impactProductNft, user1, user2 } =
        await loadFixture(deployImpactProductNFTFixture);

      try {
        await impactProductNft.write.verifyPOI([user2.account.address], {
          account: user1.account,
        });
        expect.fail("Expected revert");
      } catch (err: unknown) {
        const msg = String((err as { message?: string }).message ?? err);
        expect(/Unauthorized|Ownable|revert/i.test(msg)).to.equal(true);
      }
    });

    it("Should reject verification with zero address", async function () {
      const { impactProductNft, owner, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      await expectRevert(
        impactProductNft.simulate.verifyPOI(
          ["0x0000000000000000000000000000000000000000"],
          {
            account: owner.account,
          }
        ),
        "Invalid address"
      );

      const zeroVerified = await impactProductNft.read.verifiedPOI([
        "0x0000000000000000000000000000000000000000",
      ]);
      expect(zeroVerified).to.equal(false);
    });
  });

  describe("NFT Minting", function () {
    it("Should allow verified POI to mint an NFT", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      // Check ownership and levels
      const tokenOwner = await impactProductNft.read.ownerOf([0n]);
      expect(tokenOwner.toLowerCase()).to.equal(user1.account.address.toLowerCase());
    });

    it("Should emit Minted event when minting an NFT", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      const tx = await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("Should prevent non-verified POI from minting", async function () {
      const { impactProductNft, user2, publicClient, owner } =
        await loadFixture(deployImpactProductNFTFixture);

      await expectRevert(
        impactProductNft.simulate.mint([user2.account.address], {
          account: owner.account,
        }),
        "You are not a verified POI"
      );
    });

    it("Should prevent minting more than one NFT per address", async function () {
      const { impactProductNft, user1, publicClient, owner } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint first token
      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      // Try to mint second token
      await expectRevert(
        impactProductNft.simulate.mint([user1.account.address], {
          account: owner.account,
        }),
        "You have already minted a token"
      );
    });
  });
});
