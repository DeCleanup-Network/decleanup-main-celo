// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

interface IDCUNftRewardManager {
    function updateNftMintStatus(address user, bool hasMinted) external;
    function rewardImpactProductClaim(address user, uint256 level) external;
    function setPoiVerificationStatus(address user, bool status) external;
}

/**
 * @title ImpactProductNFT
 * @dev Soulbound-style NFT that tracks POI verification, impact stats, and admin transfer overrides.
 */
contract ImpactProductNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 public constant MAX_LEVEL = 10;

    address public rewardsContract;
    address public submissionContract; // Submission contract can auto-verify POI
    uint256 private _tokenIdCounter;

    // Claim fee state
    uint256 public claimFee = 0; // Fee for minting/upgrading NFT (in wei)
    bool public feeEnabled = false; // Fee enabled flag
    address payable public treasury = payable(address(0));
    uint256 public totalFeesCollected;

    mapping(address => bool) public verifiedPOI;
    mapping(address => bool) public _userHasMinted;
    mapping(address => uint256) public userLevel;
    mapping(address => uint256) private _userTokenPointer;
    mapping(uint256 => uint256) public nftLevel;
    mapping(uint256 => uint256) public impactLevel;

    mapping(uint256 => bool) private _transferAuthorized;
    mapping(uint256 => address) private _authorizedRecipient;

    event POIVerified(address indexed user);
    event Minted(address indexed user, uint256 indexed tokenId);
    event NFTUpgraded(uint256 indexed tokenId, uint256 newLevel);
    event ImpactLevelUpdated(uint256 indexed tokenId, uint256 newImpactLevel);
    event RewardsContractUpdated(address indexed newRewardsContract);
    event TransferAuthorized(uint256 indexed tokenId, address indexed recipient);
    event TransferAuthorizationRevoked(uint256 indexed tokenId);
    event RewardDistributed(address indexed user, uint256 indexed level);
    event ClaimFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeEnabledUpdated(bool enabled);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    constructor(address _rewardsContract) ERC721("Impact Product NFT", "IMPACT") Ownable(msg.sender) {
        require(_rewardsContract != address(0), "Invalid rewards contract address");
        rewardsContract = _rewardsContract;
    }

    // --- Verification ---

    /**
     * @dev Verify POI for a user
     * Can be called by owner or by Submission contract (for automatic verification)
     * This enables automatic POI verification when cleanups are approved, making the system
     * work for new users without manual intervention
     */
    function verifyPOI(address user) external {
        require(user != address(0), "Invalid address");
        
        // Allow owner to verify POI (manual verification)
        if (msg.sender == owner()) {
            verifiedPOI[user] = true;
            emit POIVerified(user);
            // Notify reward manager for streak reward distribution
            if (rewardsContract != address(0)) {
                try IDCUNftRewardManager(rewardsContract).setPoiVerificationStatus(user, true) {} catch {}
            }
            return;
        }
        
        // Allow Submission contract to verify POI automatically
        // This is set via setSubmissionContract() by the owner
        if (msg.sender == submissionContract && submissionContract != address(0)) {
            verifiedPOI[user] = true;
            emit POIVerified(user);
            // Notify reward manager for streak reward distribution
            if (rewardsContract != address(0)) {
                try IDCUNftRewardManager(rewardsContract).setPoiVerificationStatus(user, true) {} catch {}
            }
            return;
        }
        
        // If we get here, caller is not authorized
        revert("Only owner or Submission contract can verify POI");
    }

    // --- Configuration ---

    function setRewardsContract(address newRewardsContract) external onlyOwner {
        require(newRewardsContract != address(0), "Invalid rewards contract address");
        rewardsContract = newRewardsContract;
        emit RewardsContractUpdated(newRewardsContract);
    }

    function setSubmissionContract(address newSubmissionContract) external onlyOwner {
        require(newSubmissionContract != address(0), "Invalid submission contract address");
        submissionContract = newSubmissionContract;
    }

    function setClaimFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = claimFee;
        claimFee = newFee;
        emit ClaimFeeUpdated(oldFee, newFee);
    }

    function setFeeEnabled(bool enabled) external onlyOwner {
        feeEnabled = enabled;
        emit FeeEnabledUpdated(enabled);
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function withdrawFees() external onlyOwner {
        require(treasury != address(0), "Treasury not set");
        uint256 amount = address(this).balance;
        require(amount > 0, "No fees to withdraw");
        (bool success, ) = treasury.call{value: amount}("");
        require(success, "Fee withdrawal failed");
    }

    // --- Minting ---

    function safeMint() external payable {
        // Validate and collect fee if enabled
        if (feeEnabled) {
            require(msg.value >= claimFee, "Insufficient claim fee");
            totalFeesCollected += msg.value;
            // Transfer fee to treasury if set
            if (treasury != address(0) && msg.value > 0) {
                (bool success, ) = treasury.call{value: msg.value}("");
                require(success, "Fee transfer failed");
            }
        }
        _requireVerified(msg.sender);
        _mintTo(msg.sender);
    }

    function mint(address user) external onlyOwner {
        _requireVerified(user);
        _mintTo(user);
    }

    function _mintTo(address user) internal {
        require(!_userHasMinted[user], "You have already minted a token");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;

        nftLevel[tokenId] = 1;
        impactLevel[tokenId] = 1;
        userLevel[user] = 1;
        _userHasMinted[user] = true;

        _safeMint(user, tokenId);
        _setUserTokenPointer(user, tokenId);
        _notifyRewardsContract(user, true);

        // Distribute level reward (10 $cDCU) and referral reward (3 $cDCU) if applicable
        if (rewardsContract != address(0)) {
            try IDCUNftRewardManager(rewardsContract).rewardImpactProductClaim(user, 1) {} catch {}
        }

        emit Minted(user, tokenId);
    }

    // --- Upgrades & Impact ---

    function upgradeNFT(uint256 tokenId) external payable {
        // Validate and collect fee if enabled
        if (feeEnabled) {
            require(msg.value >= claimFee, "Insufficient claim fee");
            totalFeesCollected += msg.value;
            // Transfer fee to treasury if set
            if (treasury != address(0) && msg.value > 0) {
                (bool success, ) = treasury.call{value: msg.value}("");
                require(success, "Fee transfer failed");
            }
        }
        _requireTokenOwned(tokenId);
        require(ownerOf(tokenId) == msg.sender, "You don't own this token");
        _requireVerified(msg.sender);

        uint256 currentLevel = nftLevel[tokenId];
        require(currentLevel < MAX_LEVEL, "You have reached the maximum level");

        uint256 newLevel = currentLevel + 1;
        nftLevel[tokenId] = newLevel;
        userLevel[msg.sender] = newLevel;

        // Distribute level reward (10 $cDCU) for the new level
        if (rewardsContract != address(0)) {
            try IDCUNftRewardManager(rewardsContract).rewardImpactProductClaim(msg.sender, newLevel) {} catch {}
        }

        emit NFTUpgraded(tokenId, newLevel);
    }

    function updateImpactLevel(uint256 tokenId, uint256 newImpactLevel) external onlyOwner {
        _requireTokenOwned(tokenId);
        require(
            newImpactLevel > 0 && newImpactLevel <= MAX_LEVEL,
            "Invalid impact level range"
        );
            
        impactLevel[tokenId] = newImpactLevel;
        emit ImpactLevelUpdated(tokenId, newImpactLevel);
    }

    // --- Reward Distribution ---

    function distributeReward(address user, uint256 level) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(verifiedPOI[user], "User is not a verified POI");
        require(level >= 1 && level <= MAX_LEVEL, "Invalid level range");

        emit RewardDistributed(user, level);
    }

    // --- Soulbound controls ---

    function authorizeTransfer(uint256 tokenId, address recipient) external onlyOwner {
        _requireTokenOwned(tokenId);
        require(recipient != address(0), "Invalid recipient");

        _transferAuthorized[tokenId] = true;
        _authorizedRecipient[tokenId] = recipient;
        emit TransferAuthorized(tokenId, recipient);
    }

    function revokeTransferAuthorization(uint256 tokenId) external onlyOwner {
        _requireTokenOwned(tokenId);
        _clearTransferAuthorization(tokenId);
        emit TransferAuthorizationRevoked(tokenId);
    }

    function adminTransfer(uint256 tokenId, address recipient) external onlyOwner {
        _requireTokenOwned(tokenId);
        require(recipient != address(0), "Invalid recipient");

        address from = ownerOf(tokenId);
        _transferAuthorized[tokenId] = true;
        _authorizedRecipient[tokenId] = recipient;
        _transfer(from, recipient, tokenId);
        _clearTransferAuthorization(tokenId);
    }

    function isTransferAuthorized(uint256 tokenId) external view returns (bool authorized, address recipient) {
        authorized = _transferAuthorized[tokenId];
        recipient = _authorizedRecipient[tokenId];
    }

    // --- Views ---

    function getUserNFTData(address user) external view returns (uint256 tokenId, uint256 impact, uint256 level) {
        uint256 pointer = _userTokenPointer[user];
        require(pointer != 0, "User has no NFT");
        tokenId = pointer - 1;
        require(ownerOf(tokenId) == user, "User has no NFT");

        impact = impactLevel[tokenId];
        level = userLevel[user];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireTokenOwned(tokenId);

        uint256 level = nftLevel[tokenId];
        uint256 impact = impactLevel[tokenId];
        string memory category = _categoryForLevel(level);
        
        bytes memory metadata = abi.encodePacked(
            '{"name":"Impact Product #',
                tokenId.toString(),
            '","description":"DeCleanup Impact Product NFT","attributes":[',
            _attributeJson("Level", level.toString()),
            ",",
            _attributeJson("Impact", impact.toString()),
            ",",
            _attributeJson("Category", category),
            "]}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(metadata));
    }

    // --- Internal helpers ---

    function _clearTransferAuthorization(uint256 tokenId) internal {
        if (_transferAuthorized[tokenId]) {
            _transferAuthorized[tokenId] = false;
            _authorizedRecipient[tokenId] = address(0);
        }
    }

    function _requireVerified(address user) internal view {
        require(verifiedPOI[user], "You are not a verified POI");
    }

    function _requireTokenOwned(uint256 tokenId) internal view {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
    }

    function _categoryForLevel(uint256 level) internal pure returns (string memory) {
        if (level <= 3) return "Newbie";
        if (level <= 6) return "Pro";
        if (level <= 9) return "Hero";
        return "Guardian";
    }

    function _attributeJson(string memory traitType, string memory value) internal pure returns (bytes memory) {
        return abi.encodePacked('{"trait_type":"', traitType, '","value":"', value, '"}');
    }

    function _setUserTokenPointer(address user, uint256 tokenId) internal {
        _userTokenPointer[user] = tokenId + 1;
    }

    function _notifyRewardsContract(address user, bool hasMinted) internal {
        if (rewardsContract != address(0)) {
            try IDCUNftRewardManager(rewardsContract).updateNftMintStatus(user, hasMinted) {} catch {}
        }
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address previousOwner = _ownerOf(tokenId);
        
        if (previousOwner != address(0) && to != address(0)) {
            if (!_transferAuthorized[tokenId] || _authorizedRecipient[tokenId] != to) {
                revert("ImpactProductNFT: transfers are restricted (soulbound NFT)");
            }
        }

        address from = super._update(to, tokenId, auth);

        if (previousOwner != address(0) && to != address(0)) {
            _clearTransferAuthorization(tokenId);
        }

        if (from != to) {
            if (from != address(0)) {
                _userTokenPointer[from] = 0;
            }
            if (to != address(0)) {
                _setUserTokenPointer(to, tokenId);
                _userHasMinted[to] = true;
                userLevel[to] = nftLevel[tokenId];
                _notifyRewardsContract(to, true);
    }
}
        return from;
    }
}

