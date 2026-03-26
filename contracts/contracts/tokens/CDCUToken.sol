// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title CDCUToken
 * @dev DeCleanup Proof Token ($cDCU) — ERC-20 with hardcoded 10M cap.
 *      Only ClaimVault can mint. Per TOKEN_SPEC.md v1.1.
 */
contract CDCUToken is ERC20 {
    /// @dev 10,000,000 * 10^18
    uint256 public constant MAX_SUPPLY = 10_000_000 * 1e18;

    /// @dev Only this address may call mint(). Set once after ClaimVault is deployed.
    address public claimVault;

    error CDCUToken__MaxSupplyExceeded(uint256 currentSupply, uint256 amount, uint256 maxSupply);
    error CDCUToken__OnlyClaimVault();
    error CDCUToken__ClaimVaultAlreadySet();

    event ClaimVaultSet(address indexed vault);
    event Minted(address indexed to, uint256 amount);

    constructor() ERC20("DeCleanup Proof Token", "cDCU") {}

    /**
     * @dev Set the ClaimVault (minter). Callable only once, after ClaimVault is deployed.
     */
    function setClaimVault(address _claimVault) external {
        if (claimVault != address(0)) revert CDCUToken__ClaimVaultAlreadySet();
        if (_claimVault == address(0)) revert CDCUToken__ClaimVaultAlreadySet();
        claimVault = _claimVault;
        emit ClaimVaultSet(_claimVault);
    }

    /**
     * @dev Mint tokens. Only ClaimVault. Reverts if totalSupply + amount > MAX_SUPPLY.
     */
    function mint(address to, uint256 amount) external {
        if (msg.sender != claimVault) revert CDCUToken__OnlyClaimVault();
        uint256 newSupply = totalSupply() + amount;
        if (newSupply > MAX_SUPPLY) revert CDCUToken__MaxSupplyExceeded(totalSupply(), amount, MAX_SUPPLY);
        _mint(to, amount);
        emit Minted(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
