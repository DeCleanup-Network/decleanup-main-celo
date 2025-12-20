// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IDCUToken.sol";

interface ISubmissionHypercerts {
    function userHypercertCount(address user) external view returns (uint256);
}

/**
 * @title DCURewardManager
 * @dev Handles reward accrual and distribution for the DeCleanup Network
 */
contract DCURewardManager is Ownable, ReentrancyGuard {
    enum RewardSource {
        ImpactClaim,
        Streak,
        Referral,
        ImpactReport,
        Verifier,
        Hypercert,
        Submission
    }

    struct UserRewardStats {
        uint256 currentBalance;
        uint256 totalEarned;
        uint256 totalClaimed;
        uint256 claimRewardsAmount;
        uint256 streakRewardsAmount;
        uint256 referralRewardsAmount;
        uint256 impactReportRewardsAmount;
    }

    IDCUToken public immutable dcuToken;
    address public nftCollection;
    address public submissionContract;
    address public treasury;

    uint256 public impactProductClaimReward = 10 ether;
    uint256 public referralReward = 3 ether; // standardized per Issue #5
    uint256 public streakReward = 3 ether;
    uint256 public impactReportReward = 5 ether;
    uint256 public verifierReward = 1 ether;
    uint256 public hypercertBonus = 10 ether;

    uint256 private constant MAX_REWARD_AMOUNT = 1000 ether;
    uint256 private constant MIN_LEVEL = 1;
    uint256 private constant MAX_LEVEL = 10;
    uint256 private constant STREAK_WINDOW = 7 days;

    mapping(address => uint256) public userBalances;
    mapping(address => uint256) public totalEarned;
    mapping(address => uint256) public totalClaimed;
    mapping(address => uint256) public claimRewardsAmount;
    mapping(address => uint256) public streakRewardsAmount;
    mapping(address => uint256) public referralRewardsAmount;
    mapping(address => uint256) public impactReportRewardsAmount;
    mapping(address => bool) public poiVerified;
    mapping(address => bool) public nftMinted;
    mapping(address => bool) private manualEligibility;
    mapping(address => bool) public rewardEligibility;
    mapping(address => uint256) public lastPoiTimestamp;
    mapping(address => mapping(uint256 => bool)) public impactProductClaimed;
    mapping(address => address) public referrers;
    mapping(address => bool) public referralRewarded;
    mapping(bytes32 => bool) public hypercertRewardsClaimed;

    event RewardAccrued(address indexed user, uint256 amount, uint8 rewardType, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event ReferralRegistered(address indexed invitee, address indexed referrer);
    event ReferralRewarded(address indexed referrer, address indexed invitee, uint256 amount);
    event PoiVerificationUpdated(address indexed user, bool verified);
    event NftMintStatusUpdated(address indexed user, bool minted);
    event RewardEligibilityUpdated(address indexed user, bool eligible, bool manualOverride);
    event NftCollectionUpdated(address indexed oldCollection, address indexed newCollection);
    event SubmissionContractUpdated(address indexed oldSubmission, address indexed newSubmission);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RewardAmountsUpdated(uint256 claimReward, uint256 referralReward, uint256 streakReward);
    event ReferralRewardUpdated(uint256 oldAmount, uint256 newAmount);
    event ImpactReportRewardUpdated(uint256 oldAmount, uint256 newAmount);
    event VerifierRewardUpdated(uint256 oldAmount, uint256 newAmount);
    event HypercertBonusUpdated(uint256 oldAmount, uint256 newAmount);
    event HypercertRewardClaimed(address indexed user, uint256 hypercertNumber, uint256 amount);
    event DCURewardImpactProduct(address indexed user, uint256 indexed level, uint256 amount);
    event DCURewardReferral(address indexed referrer, address indexed invitee, uint256 amount);
    event DCURewardStreak(address indexed user, uint256 amount, uint256 streakDays);

    modifier onlyNftOrOwner() {
        require(msg.sender == nftCollection || msg.sender == owner(), "REWARD__Unauthorized");
        _;
    }

    modifier onlySubmissionOrOwner() {
        require(
            msg.sender == submissionContract || msg.sender == owner(),
            "REWARD__Unauthorized"
        );
        _;
    }

    constructor(address _dcuToken, address _nftCollection) Ownable(msg.sender) {
        require(_dcuToken != address(0), "REWARD__InvalidAddress");
        dcuToken = IDCUToken(_dcuToken);
        nftCollection = _nftCollection;
        treasury = msg.sender;
    }

    // ----------- Configuration -----------

    function updateNftCollection(address _nftCollection) external onlyOwner {
        require(_nftCollection != address(0), "REWARD__InvalidAddress");
        address oldCollection = nftCollection;
        nftCollection = _nftCollection;
        emit NftCollectionUpdated(oldCollection, _nftCollection);
    }

    function setSubmissionContract(address _submission) external onlyOwner {
        require(_submission != address(0), "REWARD__InvalidAddress");
        address oldSubmission = submissionContract;
        submissionContract = _submission;
        emit SubmissionContractUpdated(oldSubmission, _submission);
    }

    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "REWARD__InvalidAddress");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function updateRewardAmounts(
        uint256 newClaimReward,
        uint256 newReferralReward,
        uint256 newStreakReward
    ) external onlyOwner {
        _validateRewardAmount(newClaimReward);
        _validateRewardAmount(newReferralReward);
        _validateRewardAmount(newStreakReward);

        impactProductClaimReward = newClaimReward;
        referralReward = newReferralReward;
        streakReward = newStreakReward;
        emit RewardAmountsUpdated(newClaimReward, newReferralReward, newStreakReward);
    }

    /**
     * @dev Admin setter for referral reward with safety checks.
     */
    function updateReferralReward(uint256 newReferralReward) external onlyOwner {
        require(newReferralReward > 0, "REWARD__ZeroAmount");
        _validateRewardAmount(newReferralReward);
        uint256 old = referralReward;
        referralReward = newReferralReward;
        emit ReferralRewardUpdated(old, newReferralReward);
    }

    /**
     * @dev Update impact report reward amount
     */
    function updateImpactReportReward(uint256 newImpactReportReward) external onlyOwner {
        require(newImpactReportReward > 0, "REWARD__ZeroAmount");
        _validateRewardAmount(newImpactReportReward);
        uint256 old = impactReportReward;
        impactReportReward = newImpactReportReward;
        emit ImpactReportRewardUpdated(old, newImpactReportReward);
    }

    /**
     * @dev Update verifier reward amount
     */
    function updateVerifierReward(uint256 newVerifierReward) external onlyOwner {
        require(newVerifierReward > 0, "REWARD__ZeroAmount");
        _validateRewardAmount(newVerifierReward);
        uint256 old = verifierReward;
        verifierReward = newVerifierReward;
        emit VerifierRewardUpdated(old, newVerifierReward);
    }

    /**
     * @dev Update hypercert bonus amount
     */
    function updateHypercertBonus(uint256 newHypercertBonus) external onlyOwner {
        require(newHypercertBonus > 0, "REWARD__ZeroAmount");
        _validateRewardAmount(newHypercertBonus);
        uint256 old = hypercertBonus;
        hypercertBonus = newHypercertBonus;
        emit HypercertBonusUpdated(old, newHypercertBonus);
    }

    function setRewardEligibilityForTesting(address user, bool status) external onlyOwner {
        require(user != address(0), "REWARD__InvalidAddress");
        manualEligibility[user] = status;
        _updateEligibility(user);
    }

    // ----------- Verification & Mint Status -----------

    function setPoiVerificationStatus(address user, bool status) external onlyNftOrOwner {
        require(user != address(0), "REWARD__InvalidAddress");

        if (status) {
            uint256 previousTimestamp = lastPoiTimestamp[user];
            if (
                previousTimestamp != 0 &&
                block.timestamp - previousTimestamp <= STREAK_WINDOW
            ) {
                _addReward(user, streakReward, RewardSource.Streak);
                streakRewardsAmount[user] += streakReward;
                uint256 streakDays = (block.timestamp - previousTimestamp) / 1 days;
                if (streakDays == 0) {
                    streakDays = 1;
                }
                emit DCURewardStreak(user, streakReward, streakDays);
            }
            lastPoiTimestamp[user] = block.timestamp;
            poiVerified[user] = true;
        } else {
            poiVerified[user] = false;
            lastPoiTimestamp[user] = 0;
        }

        emit PoiVerificationUpdated(user, status);
        _updateEligibility(user);
    }

    function updateNftMintStatus(address user, bool hasMinted) external onlyNftOrOwner {
        require(user != address(0), "REWARD__InvalidAddress");
        nftMinted[user] = hasMinted;
        emit NftMintStatusUpdated(user, hasMinted);
        _updateEligibility(user);
    }

    function getVerificationStatus(address user)
        external
        view
        returns (bool poiStatus, bool nftStatus, bool eligible)
    {
        poiStatus = poiVerified[user];
        nftStatus = nftMinted[user];
        eligible = _isRewardEligible(user);
    }

    // ----------- Referral Logic -----------

    function registerReferral(address invitee, address referrer) external onlySubmissionOrOwner {
        require(invitee != address(0) && referrer != address(0), "REWARD__InvalidAddress");
        require(invitee != referrer, "REWARD__InvalidAddress");
        require(referrers[invitee] == address(0), "Referral already registered");
        
        referrers[invitee] = referrer;
        emit ReferralRegistered(invitee, referrer);
    }

    function getReferrer(address invitee) external view returns (address) {
        return referrers[invitee];
    }

    // ----------- Reward Accrual -----------

    function rewardImpactProductClaim(address user, uint256 level) external onlyNftOrOwner {
        _requireValidLevel(level);
        require(user != address(0), "REWARD__InvalidAddress");
        require(_isRewardEligible(user), "User not eligible for rewards");
        require(!impactProductClaimed[user][level], "Level already claimed");

        impactProductClaimed[user][level] = true;
        _addReward(user, impactProductClaimReward, RewardSource.ImpactClaim);
        claimRewardsAmount[user] += impactProductClaimReward;
        emit DCURewardImpactProduct(user, level, impactProductClaimReward);

        address referrer = referrers[user];
        if (referrer != address(0) && !referralRewarded[user]) {
            referralRewarded[user] = true;
            // Give referrer 3 $cDCU for referring
            _addReward(referrer, referralReward, RewardSource.Referral);
            referralRewardsAmount[referrer] += referralReward;
            emit ReferralRewarded(referrer, user, referralReward);
            emit DCURewardReferral(referrer, user, referralReward);
            
            // Give invitee 3 $cDCU as referral bonus (only on first level claim)
            if (level == 1) {
                _addReward(user, referralReward, RewardSource.Referral);
                referralRewardsAmount[user] += referralReward;
                emit ReferralRewarded(user, referrer, referralReward);
                emit DCURewardReferral(user, referrer, referralReward);
            }
        }
    }

    function rewardVerifier(address verifier) external onlySubmissionOrOwner {
        require(verifier != address(0), "REWARD__InvalidAddress");
        _addReward(verifier, verifierReward, RewardSource.Verifier);
    }

    function rewardImpactReports(address user, uint256 reportCount) external onlySubmissionOrOwner {
        require(user != address(0), "REWARD__InvalidAddress");
        require(reportCount > 0, "REWARD__ZeroAmount");
        uint256 rewardAmount = impactReportReward * reportCount;
        _addReward(user, rewardAmount, RewardSource.ImpactReport);
        impactReportRewardsAmount[user] += rewardAmount;
    }

    function rewardHypercertMint(address user) external onlyOwner {
        require(user != address(0), "REWARD__InvalidAddress");
        _addReward(user, hypercertBonus, RewardSource.Hypercert);
    }

    function claimHypercertReward(uint256 hypercertNumber) external nonReentrant {
        require(submissionContract != address(0), "Submission not set");
        require(hypercertNumber > 0, "Invalid hypercert number");

        uint256 mintedCount = ISubmissionHypercerts(submissionContract).userHypercertCount(
            msg.sender
        );
        require(mintedCount >= hypercertNumber, "Hypercert not minted");

        bytes32 claimKey = keccak256(abi.encodePacked(msg.sender, hypercertNumber));
        require(!hypercertRewardsClaimed[claimKey], "Reward already claimed");

        hypercertRewardsClaimed[claimKey] = true;
        _addReward(msg.sender, hypercertBonus, RewardSource.Hypercert);
        emit HypercertRewardClaimed(msg.sender, hypercertNumber, hypercertBonus);
    }

    function distributeRewards(address user, uint256 amount) external onlySubmissionOrOwner {
        _addReward(user, amount, RewardSource.Submission);
    }

    // ----------- Claiming -----------

    function claimRewards(uint256 amount) external nonReentrant {
        require(amount > 0, "REWARD__ZeroAmount");
        require(userBalances[msg.sender] >= amount, "REWARD__InsufficientBalance");

        userBalances[msg.sender] -= amount;
        totalClaimed[msg.sender] += amount;

        require(dcuToken.mint(msg.sender, amount), "Reward claim failed");
        emit RewardsClaimed(msg.sender, amount, block.timestamp);
    }

    // ----------- Views -----------

    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    function getTotalEarnedDCU(address user) external view returns (uint256) {
        return totalEarned[user];
    }

    function getRewardsBreakdown(address user)
        external
        view
        returns (
            uint256 claimReward,
            uint256 streakRewardAmount,
            uint256 referralRewardAmount,
        uint256 currentBalance,
        uint256 claimedRewards
        )
    {
        claimReward = claimRewardsAmount[user];
        streakRewardAmount = streakRewardsAmount[user];
        referralRewardAmount = referralRewardsAmount[user];
        currentBalance = userBalances[user];
        claimedRewards = totalClaimed[user];
    }

    function getUserRewardStats(address user) external view returns (UserRewardStats memory) {
        return
            UserRewardStats({
                currentBalance: userBalances[user],
                totalEarned: totalEarned[user],
                totalClaimed: totalClaimed[user],
                claimRewardsAmount: claimRewardsAmount[user],
                streakRewardsAmount: streakRewardsAmount[user],
                referralRewardsAmount: referralRewardsAmount[user],
                impactReportRewardsAmount: impactReportRewardsAmount[user]
            });
    }

    // ----------- Internal Helpers -----------

    function _addReward(
        address user,
        uint256 amount,
        RewardSource source
    ) internal {
        if (amount == 0) {
            return;
        }

        userBalances[user] += amount;
        totalEarned[user] += amount;

        emit RewardAccrued(user, amount, uint8(source), block.timestamp);
    }

    function _updateEligibility(address user) internal {
        bool eligible = _isRewardEligible(user);
        rewardEligibility[user] = eligible;
        emit RewardEligibilityUpdated(user, eligible, manualEligibility[user]);
    }

    function _isRewardEligible(address user) internal view returns (bool) {
        if (manualEligibility[user]) {
            return true;
        }
        return poiVerified[user] && nftMinted[user];
    }

    function _requireValidLevel(uint256 level) internal pure {
        require(level >= MIN_LEVEL && level <= MAX_LEVEL, "REWARD__InvalidLevel");
    }

    function _validateRewardAmount(uint256 amount) internal pure {
        require(amount <= MAX_REWARD_AMOUNT, "REWARD__ExcessiveRewardAmount");
    }
}
