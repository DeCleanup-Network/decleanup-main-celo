// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IRobinhoodSubmission {
    function submissions(uint256 submissionId)
        external
        view
        returns (
            uint256 id,
            address submitter,
            string memory dataURI,
            string memory beforePhotoHash,
            string memory afterPhotoHash,
            string memory impactFormDataHash,
            int256 latitude,
            int256 longitude,
            uint256 timestamp,
            uint8 status,
            address approver,
            uint256 processedTimestamp,
            bool rewarded,
            uint256 feePaid,
            bool feeRefunded,
            bool hasImpactForm,
            bool hasRecyclables,
            string memory recyclablesPhotoHash,
            string memory recyclablesReceiptHash
        );
}

interface IRobinhoodRewardLedger {
    function getTotalEarnedDCU(address user) external view returns (uint256);
    function getReferrer(address invitee) external view returns (address);
}

/**
 * @title RDCUToken
 * @dev Robinhood Chain testnet demo ERC-20 ($rDCU). Owner can mint for the demo.
 *      Verify pays a one-time 10 $rDCU cleanup reward. Other actions (streak, referral,
 *      tRWA claim, reports, verifier) mint the DCURewardManager ledger delta as $rDCU.
 *      Separate from Celo $cDCU / ClaimVault — do not use this on Celo or Base.
 */
contract RDCUToken is ERC20, Ownable {
    uint8 public constant SUBMISSION_APPROVED = 1;

    IRobinhoodSubmission public submission;
    IRobinhoodRewardLedger public rewardManager;
    uint256 public verifyRewardAmount = 10 ether;
    mapping(uint256 => bool) public mintedForSubmission;
    mapping(address => uint256) public syncedLedgerAmount;

    error RDCU__InvalidSubmission();
    error RDCU__InvalidRewardManager();
    error RDCU__NotApproved();
    error RDCU__AlreadyMinted();
    error RDCU__InvalidAmount();

    event VerifyRewardMinted(uint256 indexed submissionId, address indexed submitter, uint256 amount);
    event LedgerSynced(address indexed user, uint256 amount, uint256 totalEarned);

    constructor(
        address submission_,
        address rewardManager_
    ) ERC20("DeCleanup Robinhood Token", "rDCU") Ownable(msg.sender) {
        if (submission_ == address(0)) revert RDCU__InvalidSubmission();
        if (rewardManager_ == address(0)) revert RDCU__InvalidRewardManager();
        submission = IRobinhoodSubmission(submission_);
        rewardManager = IRobinhoodRewardLedger(rewardManager_);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function mintForApprovedSubmission(uint256 submissionId) public {
        if (mintedForSubmission[submissionId]) revert RDCU__AlreadyMinted();

        (address submitter, uint8 status, ) = _submissionParties(submissionId);
        if (submitter == address(0)) revert RDCU__InvalidSubmission();
        if (status != SUBMISSION_APPROVED) revert RDCU__NotApproved();

        mintedForSubmission[submissionId] = true;
        _mint(submitter, verifyRewardAmount);
        emit VerifyRewardMinted(submissionId, submitter, verifyRewardAmount);
    }

    /// @notice Pay the 10 $rDCU verify reward (if still unpaid) and mint any new ledger DCU
    ///         for the submitter, verifier, and referrer (streak, verifier, later referral).
    function settleAfterVerify(uint256 submissionId) external {
        if (!mintedForSubmission[submissionId]) {
            mintForApprovedSubmission(submissionId);
        }

        (address submitter, uint8 status, address approver) = _submissionParties(submissionId);
        if (submitter == address(0) || status != SUBMISSION_APPROVED) revert RDCU__NotApproved();

        _sync(submitter);
        _sync(approver);
        _sync(rewardManager.getReferrer(submitter));
    }

    /// @notice Mint newly accrued DCURewardManager points (tRWA claim, referral, reports) as $rDCU.
    function settleUser(address user) external {
        _sync(user);
        if (user != address(0)) {
            _sync(rewardManager.getReferrer(user));
        }
    }

    function setSubmission(address submission_) external onlyOwner {
        if (submission_ == address(0)) revert RDCU__InvalidSubmission();
        submission = IRobinhoodSubmission(submission_);
    }

    function setRewardManager(address rewardManager_) external onlyOwner {
        if (rewardManager_ == address(0)) revert RDCU__InvalidRewardManager();
        rewardManager = IRobinhoodRewardLedger(rewardManager_);
    }

    function setVerifyRewardAmount(uint256 amount) external onlyOwner {
        if (amount == 0) revert RDCU__InvalidAmount();
        verifyRewardAmount = amount;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function _submissionParties(
        uint256 submissionId
    ) internal view returns (address submitter, uint8 status, address approver) {
        (, submitter, , , , , , , , status, approver, , , , , , , , ) = submission.submissions(submissionId);
    }

    function _sync(address user) internal {
        if (user == address(0)) return;
        uint256 earned = rewardManager.getTotalEarnedDCU(user);
        uint256 already = syncedLedgerAmount[user];
        if (earned <= already) return;
        uint256 delta = earned - already;
        syncedLedgerAmount[user] = earned;
        _mint(user, delta);
        emit LedgerSynced(user, delta, earned);
    }
}
