// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./tokens/CDCUToken.sol";

/**
 * @title ClaimVault
 * @dev Mint-on-claim vault for $cDCU. Validates EIP-712 signed authorizations,
 *      enforces category caps and nonce uniqueness. Per TOKEN_SPEC.md v1.1.
 */
contract ClaimVault is Ownable, ReentrancyGuard, EIP712 {
    CDCUToken public immutable token;

    /// @dev Authorized signer (backend). Only this address's signatures are accepted.
    address public authorizedSigner;

    /// @dev Allocation categories and caps (wei). Index matches ClaimCategory enum.
    uint256[7] public categoryCaps;
    uint256[7] public categoryMinted;

    mapping(uint256 => bool) public usedNonces;

    bool public liquidityMinted;

    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "Claim(address recipient,uint256 amount,uint8 category,uint256 nonce,uint256 expiry)"
    );

    enum ClaimCategory {
        StakingVerifier,      // 0 — 33% = 3_300_000
        CleanupCampaign,      // 1 — 25% = 2_500_000
        PublicDistribution,   // 2 — 20% = 2_000_000
        TeamDev,              // 3 — 10% = 1_000_000
        VerificationTreasury, // 4 — 5%  = 500_000
        CommunityIncentives,  // 5 — 4%  = 400_000
        Liquidity             // 6 — 3%  = 300_000 (pre-mint at launch only)
    }

    uint256 public constant MAX_CLAIM_EXPIRY_WINDOW = 30 days;

    error ClaimVault__InvalidSignature();
    error ClaimVault__NonceAlreadyUsed();
    error ClaimVault__Expired();
    error ClaimVault__ExpiryTooFar(uint256 expiry, uint256 maxAllowed);
    error ClaimVault__CategoryCapExceeded(uint8 category, uint256 minted, uint256 cap, uint256 amount);
    error ClaimVault__InvalidCategory();
    error ClaimVault__LiquidityAlreadyMinted();
    error ClaimVault__ZeroAddress();

    event Claimed(address indexed recipient, uint256 amount, ClaimCategory category, uint256 nonce);
    event AuthorizedSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event LiquidityMinted(address indexed lpContract, uint256 amount);

    constructor(address _token, address _authorizedSigner) Ownable(msg.sender) EIP712("ClaimVault", "1") {
        if (_token == address(0) || _authorizedSigner == address(0)) revert ClaimVault__ZeroAddress();
        token = CDCUToken(_token);
        authorizedSigner = _authorizedSigner;

        categoryCaps[uint8(ClaimCategory.StakingVerifier)] = 3_300_000 * 1e18;
        categoryCaps[uint8(ClaimCategory.CleanupCampaign)] = 2_500_000 * 1e18;
        categoryCaps[uint8(ClaimCategory.PublicDistribution)] = 2_000_000 * 1e18;
        categoryCaps[uint8(ClaimCategory.TeamDev)] = 1_000_000 * 1e18;
        categoryCaps[uint8(ClaimCategory.VerificationTreasury)] = 500_000 * 1e18;
        categoryCaps[uint8(ClaimCategory.CommunityIncentives)] = 400_000 * 1e18;
        categoryCaps[uint8(ClaimCategory.Liquidity)] = 300_000 * 1e18;
    }

    /**
     * @dev Claim $cDCU using a backend-signed EIP-712 authorization.
     */
    function claim(
        address recipient,
        uint256 amount,
        uint8 category,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (block.timestamp > expiry) revert ClaimVault__Expired();
        if (expiry > block.timestamp + MAX_CLAIM_EXPIRY_WINDOW) revert ClaimVault__ExpiryTooFar(expiry, block.timestamp + MAX_CLAIM_EXPIRY_WINDOW);
        if (category > 6) revert ClaimVault__InvalidCategory();
        if (usedNonces[nonce]) revert ClaimVault__NonceAlreadyUsed();

        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, recipient, amount, category, nonce, expiry));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        if (signer != authorizedSigner) revert ClaimVault__InvalidSignature();

        uint256 idx = category;
        uint256 minted = categoryMinted[idx];
        uint256 cap = categoryCaps[idx];
        if (minted + amount > cap) revert ClaimVault__CategoryCapExceeded(category, minted, cap, amount);

        usedNonces[nonce] = true;
        categoryMinted[idx] = minted + amount;

        token.mint(recipient, amount);
        emit Claimed(recipient, amount, ClaimCategory(category), nonce);
    }

    /**
     * @dev One-time pre-mint of liquidity allocation (3%) to LP contract. Only owner.
     */
    function mintLiquidityTo(address lpContract) external onlyOwner nonReentrant {
        if (lpContract == address(0)) revert ClaimVault__ZeroAddress();
        if (liquidityMinted) revert ClaimVault__LiquidityAlreadyMinted();
        liquidityMinted = true;

        uint256 amount = 300_000 * 1e18;
        uint8 idx = uint8(ClaimCategory.Liquidity);
        categoryMinted[idx] = amount;

        token.mint(lpContract, amount);
        emit LiquidityMinted(lpContract, amount);
    }

    /**
     * @dev Update the authorized signer (e.g. rotate to multisig in Phase 3). Only owner.
     */
    function updateAuthorizedSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ClaimVault__ZeroAddress();
        address old = authorizedSigner;
        authorizedSigner = newSigner;
        emit AuthorizedSignerUpdated(old, newSigner);
    }

    /**
     * @dev View: amount already minted for a category.
     */
    function getCategoryMinted(uint8 category) external view returns (uint256) {
        return categoryMinted[category];
    }

    /**
     * @dev View: remaining mintable for a category.
     */
    function getCategoryRemaining(uint8 category) external view returns (uint256) {
        uint256 cap = categoryCaps[category];
        uint256 minted = categoryMinted[category];
        return cap > minted ? cap - minted : 0;
    }
}
