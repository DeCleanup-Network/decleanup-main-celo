// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IDCUToken.sol";
import "./DCURewardManager.sol";

interface RecyclablesReward {
    function rewardRecyclables(address user, uint256 submissionId) external;
}

interface IImpactProductNFT {
    function verifyPOI(address user) external;
    function safeMint() external;
    function upgradeNFT(uint256 tokenId) external;
    function getUserNFTData(address user) external view returns (uint256 tokenId, uint256 impact, uint256 level);
    function _userHasMinted(address user) external view returns (bool);
    function verifiedPOI(address user) external view returns (bool);
}

/**
 * @title Submission
 * @dev Contract for handling form submissions from the DeCleanup dapp
 *
 * Notes on modifications:
 * - Introduced VERIFIER_ROLE and locked approve/reject to VERIFIER_ROLE (separate from ADMIN_ROLE).
 * - Fee transfer behavior is disabled by default (feeEnabled = false). Fee storage fields kept for ABI/compatibility.
 * - Hypercert eligibility now uses NFT level from ImpactProductNFT.getUserNFTData(...) as source of truth.
 * - Reward flow delegates to DCURewardManager (distributeRewards, rewardVerifier, rewardImpactReports).
 * - Minimal behavioral changes to storage layout to preserve compatibility with existing deployments/tests.
 */
contract Submission is Ownable, ReentrancyGuard, AccessControl {
    // Custom Errors
    error SUBMISSION__InvalidAddress();
    error SUBMISSION__InvalidSubmissionData();
    error SUBMISSION__SubmissionNotFound(uint256 submissionId);
    error SUBMISSION__Unauthorized(address user);
    error SUBMISSION__AlreadyApproved(uint256 submissionId);
    error SUBMISSION__AlreadyRejected(uint256 submissionId);
    error SUBMISSION__NoRewardsAvailable();
    error SUBMISSION__InsufficientSubmissionFee(uint256 sent, uint256 required);
    error SUBMISSION__RefundFailed();
    error SUBMISSION__CannotRefundApprovedSubmission(uint256 submissionId);

    // Role definitions for access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // Submission status enum
    enum SubmissionStatus { Pending, Approved, Rejected }

    // Submission structure
    struct CleanupSubmission {
        uint256 id;
        address submitter;
        string dataURI;
        string beforePhotoHash;
        string afterPhotoHash;
        string impactFormDataHash;
        int256 latitude;
        int256 longitude;
        uint256 timestamp;
        SubmissionStatus status;
        address approver;
        uint256 processedTimestamp;
        bool rewarded;
        uint256 feePaid;
        bool feeRefunded;
        bool hasImpactForm;
        bool hasRecyclables;
        string recyclablesPhotoHash;
        string recyclablesReceiptHash;
    }

    // Contract references
    IDCUToken public dcuToken;
    DCURewardManager public rewardManager;
    IImpactProductNFT public impactProductNFT;
    address public recyclablesRewardContract;

    // Storage
    mapping(uint256 => CleanupSubmission) public submissions;
    mapping(address => uint256[]) public userSubmissions;

    uint256 public submissionCount;
    uint256 public defaultRewardAmount;

    // Fee state (kept for compatibility). Disabled by default in this version.
    uint256 public submissionFee = 0; // initially 0
    bool public feeEnabled = false;   // disabled to avoid unexpected transfers during test/dev
    address payable public treasury = payable(address(0));

    uint256 public totalFeesCollected;
    uint256 public totalFeesRefunded;

    // Referrals & impact tracking
    mapping(address => address) public referrers; // invitee => referrer
    mapping(address => uint256) public userImpactFormCount; // Track impact forms per user

    // Hypercert tracking (legacy counters kept for history; NFT level is source of truth)
    mapping(address => uint256) public userCleanupCount;
    mapping(address => uint256) public userHypercertCount;

    // Events
    event SubmissionCreated(
        uint256 indexed submissionId,
        address indexed submitter,
        string dataURI,
        uint256 timestamp
    );

    event SubmissionApproved(
        uint256 indexed submissionId,
        address indexed approver,
        uint256 timestamp
    );

    event SubmissionRejected(
        uint256 indexed submissionId,
        address indexed approver,
        uint256 timestamp
    );

    event DefaultRewardUpdated(uint256 oldAmount, uint256 newAmount);

    event RewardAvailable(
        address indexed user,
        uint256 amount,
        uint256 submissionId,
        uint256 timestamp
    );

    event SubmissionFeeUpdated(uint256 newFee, bool enabled);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event HypercertEligible(address indexed user, uint256 cleanupCount, uint256 hypercertNumber);
    event ReferralRegistered(address indexed referrer, address indexed invitee);
    event ImpactFormSubmitted(address indexed user, uint256 submissionId, uint256 totalForms);
    event RecyclablesSubmitted(address indexed user, uint256 indexed submissionId, string recyclablesPhotoHash, string recyclablesReceiptHash);
    event RecyclablesRewardContractUpdated(address indexed oldContract, address indexed newContract);

    /**
     * @dev Constructor sets up the contract with DCU token, DCURewardManager, and roles
     * @param _dcuToken Address of the DCU token contract
     * @param _rewardManager Address of the DCURewardManager contract
     * @param _defaultRewardAmount Default reward amount for approved submissions
     */
    constructor(address _dcuToken, address _rewardManager, uint256 _defaultRewardAmount) Ownable(msg.sender) {
        if (_dcuToken == address(0)) revert SUBMISSION__InvalidAddress();
        if (_rewardManager == address(0)) revert SUBMISSION__InvalidAddress();

        dcuToken = IDCUToken(_dcuToken);
        rewardManager = DCURewardManager(_rewardManager);
        defaultRewardAmount = _defaultRewardAmount;

        // Grant main admin roles to deployer/owner. Verifier should be granted explicitly with setup scripts.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // Keep fee disabled by default to avoid accidental transfers during development
        submissionFee = 0;
        feeEnabled = false;
        treasury = payable(address(0));
    }

    /**
     * @dev Create a new submission with IPFS hashes and optional referrer
     * @param dataURI IPFS URI or other storage reference to submission data
     * @param beforePhotoHash IPFS hash for before photo
     * @param afterPhotoHash IPFS hash for after photo
     * @param impactFormDataHash IPFS hash for impact form (empty string if not submitted)
     * @param lat Latitude (scaled by 1e6)
     * @param lng Longitude (scaled by 1e6)
     * @param referrer Address of referrer (address(0) if none)
     * @return submissionId The ID of the created submission
     */
    function createSubmission(
        string calldata dataURI,
        string calldata beforePhotoHash,
        string calldata afterPhotoHash,
        string calldata impactFormDataHash,
        int256 lat,
        int256 lng,
        address referrer
    ) external payable nonReentrant returns (uint256) {
        if (bytes(dataURI).length == 0) revert SUBMISSION__InvalidSubmissionData();
        if (bytes(beforePhotoHash).length == 0) revert SUBMISSION__InvalidSubmissionData();
        if (bytes(afterPhotoHash).length == 0) revert SUBMISSION__InvalidSubmissionData();

        // Fee validation kept but fee transfers are disabled by default.
        uint256 paid = 0;
        if (feeEnabled) {
            if (msg.value < submissionFee) revert SUBMISSION__InsufficientSubmissionFee(msg.value, submissionFee);
            paid = msg.value;
            totalFeesCollected += msg.value;
            // NOTE: We intentionally do NOT transfer to treasury here in this refactor.
            // Treasury sweeps (if desired) should be executed by an explicit administrative action.
        }

        // Register referrer on first submission
        if (userSubmissions[msg.sender].length == 0 && referrer != address(0) && referrer != msg.sender) {
            if (referrers[msg.sender] == address(0)) {
                referrers[msg.sender] = referrer;
                emit ReferralRegistered(referrer, msg.sender);
                
                // Also register referral in DCURewardManager so referral rewards can be distributed
                // when the user claims their first Impact Product NFT
                if (address(rewardManager) != address(0)) {
                    try rewardManager.registerReferral(msg.sender, referrer) {
                        // Referral registered successfully in reward manager
                    } catch {
                        // If registration fails, log but don't revert (best-effort)
                        // The referral is still stored in Submission contract for tracking
                    }
                }
            }
        }

        uint256 submissionId = submissionCount;
        bool hasImpactForm = bytes(impactFormDataHash).length > 0;

        submissions[submissionId] = CleanupSubmission({
            id: submissionId,
            submitter: msg.sender,
            dataURI: dataURI,
            beforePhotoHash: beforePhotoHash,
            afterPhotoHash: afterPhotoHash,
            impactFormDataHash: impactFormDataHash,
            latitude: lat,
            longitude: lng,
            timestamp: block.timestamp,
            status: SubmissionStatus.Pending,
            approver: address(0),
            processedTimestamp: 0,
            rewarded: false,
            feePaid: paid,
            feeRefunded: false,
            hasImpactForm: hasImpactForm,
            hasRecyclables: false,
            recyclablesPhotoHash: "",
            recyclablesReceiptHash: ""
        });

        userSubmissions[msg.sender].push(submissionId);
        submissionCount++;

        // Track impact form submission
        if (hasImpactForm) {
            userImpactFormCount[msg.sender]++;
            emit ImpactFormSubmitted(msg.sender, submissionId, userImpactFormCount[msg.sender]);
        }

        emit SubmissionCreated(submissionId, msg.sender, dataURI, block.timestamp);

        return submissionId;
    }

    /**
     * @dev Attach recyclables data to an existing submission
     * Can only be called by the original submitter and only for pending submissions
     */
    function attachRecyclables(
        uint256 submissionId,
        string calldata recyclablesPhotoHash,
        string calldata recyclablesReceiptHash
    ) external nonReentrant {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);

        CleanupSubmission storage s = submissions[submissionId];

        if (s.submitter != msg.sender) revert SUBMISSION__Unauthorized(msg.sender);
        if (s.status != SubmissionStatus.Pending) revert SUBMISSION__SubmissionNotFound(submissionId);
        if (bytes(recyclablesPhotoHash).length == 0) revert SUBMISSION__InvalidSubmissionData();

        s.hasRecyclables = true;
        s.recyclablesPhotoHash = recyclablesPhotoHash;
        s.recyclablesReceiptHash = recyclablesReceiptHash;

        emit RecyclablesSubmitted(msg.sender, submissionId, recyclablesPhotoHash, recyclablesReceiptHash);
    }

    /**
     * @dev Approve a submission (only for verifiers)
     * Delegates reward logic to DCURewardManager
     */
    function approveSubmission(uint256 submissionId) external nonReentrant onlyRole(VERIFIER_ROLE) {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);

        CleanupSubmission storage s = submissions[submissionId];

        if (s.status == SubmissionStatus.Approved) revert SUBMISSION__AlreadyApproved(submissionId);
        if (s.status == SubmissionStatus.Rejected) revert SUBMISSION__AlreadyRejected(submissionId);

        s.status = SubmissionStatus.Approved;
        s.approver = msg.sender;
        s.processedTimestamp = block.timestamp;

        // Legacy counter preserved for compatibility (not used for eligibility)
        userCleanupCount[s.submitter]++;

        // Mark as rewarded - the actual 10 $cDCU cleanup reward will be distributed
        // when user claims their Impact Product NFT (via rewardImpactProductClaim)
        // This ensures cleanup reward is only distributed once, when NFT is minted/upgraded
                s.rewarded = true;
                emit RewardAvailable(s.submitter, defaultRewardAmount, submissionId, block.timestamp);

        // Reward verifier (best-effort)
        try rewardManager.rewardVerifier(msg.sender) {
        } catch {
            // swallow - no revert on external reward failure
        }

        // Reward impact report (best-effort)
        // If submission has impact form, reward the user (userImpactFormCount is already incremented during submission)
        if (s.hasImpactForm) {
            try rewardManager.rewardImpactReports(s.submitter, 1) {
            } catch {
                // Log error but don't revert - impact report reward is best-effort
            }
        }

        // External recyclables reward (best-effort)
        if (s.hasRecyclables && recyclablesRewardContract != address(0)) {
            try RecyclablesReward(recyclablesRewardContract).rewardRecyclables(s.submitter, submissionId) {
            } catch {
            }
        }

        // Automatically verify POI when cleanup is approved (allows users to mint NFTs)
        // This makes the system work for new users without manual intervention
        if (address(impactProductNFT) != address(0)) {
            try impactProductNFT.verifyPOI(s.submitter) {
                // POI verified successfully
            } catch {
                // If POI verification fails (e.g., contract doesn't allow it), that's okay
                // User can still claim tokens, just won't be able to mint NFT until manually verified
            }
        }

        emit SubmissionApproved(submissionId, msg.sender, block.timestamp);

        // Emit HypercertEligible based on NFT level (ImpactProductNFT is source of truth)
        // Wrapped in try-catch because new users won't have an NFT until they claim their first level
        if (address(impactProductNFT) != address(0)) {
            try impactProductNFT.getUserNFTData(s.submitter) returns (uint256, uint256, uint256 level) {
                if (level > 0 && level % 10 == 0) {
                    userHypercertCount[s.submitter]++;
                    emit HypercertEligible(s.submitter, userCleanupCount[s.submitter], userHypercertCount[s.submitter]);
                }
            } catch {
                // If user has no NFT yet, that's fine - they'll get one when they claim
                // No need to emit hypercert eligibility for users without NFTs
            }
        }
    }

    /**
     * @dev Reject a submission (only for verifiers)
     */
    function rejectSubmission(uint256 submissionId) external nonReentrant onlyRole(VERIFIER_ROLE) {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);

        CleanupSubmission storage s = submissions[submissionId];

        if (s.status == SubmissionStatus.Rejected) revert SUBMISSION__AlreadyRejected(submissionId);
        if (s.status == SubmissionStatus.Approved) revert SUBMISSION__AlreadyApproved(submissionId);

        s.status = SubmissionStatus.Rejected;
        s.approver = msg.sender;
        s.processedTimestamp = block.timestamp;

        emit SubmissionRejected(submissionId, msg.sender, block.timestamp);
    }

    /**
     * @dev Update the default reward amount (only for admins)
     */
    function updateDefaultReward(uint256 newRewardAmount) external onlyRole(ADMIN_ROLE) {
        uint256 oldAmount = defaultRewardAmount;
        defaultRewardAmount = newRewardAmount;
        emit DefaultRewardUpdated(oldAmount, newRewardAmount);
    }

    /**
     * @dev Update submission fee (only for admins). Fee transfers are disabled by default.
     */
    function updateSubmissionFee(uint256 newFee, bool enabled) external onlyRole(ADMIN_ROLE) {
        submissionFee = newFee;
        feeEnabled = enabled;
        emit SubmissionFeeUpdated(newFee, enabled);
    }

    /**
     * @dev Update treasury address (only for owner)
     */
    function updateTreasury(address payable newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert SUBMISSION__InvalidAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @dev Update the RecyclablesReward contract address (only for owner)
     */
    function updateRecyclablesRewardContract(address _newRecyclablesRewardContract) external onlyOwner {
        address oldContract = recyclablesRewardContract;
        recyclablesRewardContract = _newRecyclablesRewardContract;
        emit RecyclablesRewardContractUpdated(oldContract, _newRecyclablesRewardContract);
    }

    /**
     * @dev Associate an ImpactProductNFT contract (only owner)
     */
    function setImpactProductNFT(address _impactProductNFT) external onlyOwner {
        if (_impactProductNFT == address(0)) revert SUBMISSION__InvalidAddress();
        impactProductNFT = IImpactProductNFT(_impactProductNFT);
    }

    /**
     * @dev Get all submissions for a user
     */
    function getSubmissionsByUser(address user) external view returns (uint256[] memory) {
        return userSubmissions[user];
    }

    /**
     * @dev Get the details of a submission
     */
    function getSubmissionDetails(uint256 submissionId) external view returns (CleanupSubmission memory) {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);
        return submissions[submissionId];
    }

    /**
     * @dev Get Hypercert eligibility for a user
     * Uses ImpactProductNFT level as source of truth (level % 10 == 0 && level > 0)
     */
    function getHypercertEligibility(address user) external view returns (
        uint256 cleanupCount,
        uint256 hypercertCount,
        bool isEligible
    ) {
        cleanupCount = userCleanupCount[user];
        hypercertCount = userHypercertCount[user];
        if (address(impactProductNFT) == address(0)) {
            isEligible = false;
        } else {
            (, , uint256 level) = impactProductNFT.getUserNFTData(user);
            isEligible = (level > 0 && level % 10 == 0);
        }
    }

    /**
     * @dev Get a batch of submissions for pagination
     */
    function getSubmissionBatch(uint256 startIndex, uint256 batchSize) external view returns (CleanupSubmission[] memory) {
        uint256 endIndex = startIndex + batchSize;
        if (endIndex > submissionCount) {
            endIndex = submissionCount;
        }
        uint256 resultSize = endIndex - startIndex;
        CleanupSubmission[] memory result = new CleanupSubmission[](resultSize);
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = submissions[startIndex + i];
        }
        return result;
    }
}
