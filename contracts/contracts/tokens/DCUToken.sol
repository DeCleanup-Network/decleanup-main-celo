// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title DCUToken
 * @dev DeCleanup Utility Token with dynamic supply model and governance features
 * Implements ERC20 standard with additional features for tracking and compatibility
 */
contract DCUToken is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    // Custom errors
    error TOKEN__SupplyCapExceeded(uint256 attemptedSupply, uint256 supplyCap);
    error TOKEN__CapTooLow(uint256 requestedCap, uint256 currentSupply);
    error TOKEN__Unauthorized(address sender);

    // Events for detailed tracking
    event DCUMinted(
        address indexed to,
        uint256 amount,
        uint256 newBalance,
        uint256 timestamp
    );
    
    event DCUBurned(
        address indexed from,
        uint256 amount,
        uint256 newBalance,
        uint256 timestamp
    );
    
    event SupplyCapAdded(
        uint256 capAmount,
        uint256 timestamp,
        address indexed by
    );
    
    event SupplyCapRemoved(
        uint256 timestamp,
        address indexed by
    );

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // State variables
    uint256 public totalMinted;
    uint256 public supplyCap;
    bool public supplyCapActive;
    
    // Additional ERC20 metadata
    uint8 private constant _decimals = 18;
    
    /**
     * @dev Constructor for DCUToken
     */
    constructor() 
        ERC20("DeCleanup Utility Token", "DCU") 
        ERC20Permit("DeCleanup Utility Token")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender); // Grant minter role to deployer initially
        supplyCapActive = false; // Start with no supply cap
    }
    
    /**
     * @dev Returns the number of decimals used for user representation
     * @return The number of decimals
     */
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint new tokens - only callable by the RewardLogic contract
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     * @return success Whether the minting was successful
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) returns (bool) {
        // If a supply cap is active, enforce it
        if (supplyCapActive) {
            if (totalSupply() + amount > supplyCap)
                revert TOKEN__SupplyCapExceeded(totalSupply() + amount, supplyCap);
        }
        
        // Track total minted supply for future reference
        totalMinted += amount;
        
        // Mint the tokens
        _mint(to, amount);
        
        // Emit detailed minting event
        emit DCUMinted(
            to,
            amount,
            balanceOf(to),
            block.timestamp
        );
        
        return true;
    }

    /**
     * @dev Burn tokens - only callable by owner
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);
        
        // Emit detailed burning event
        emit DCUBurned(
            from,
            amount,
            balanceOf(from),
            block.timestamp
        );
    }
    
    /**
     * @dev Set a cap on the total token supply (for future governance)
     * @param _supplyCap The maximum total supply
     */
    function setSupplyCap(uint256 _supplyCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_supplyCap <= totalSupply())
            revert TOKEN__CapTooLow(_supplyCap, totalSupply());
            
        supplyCap = _supplyCap;
        supplyCapActive = true;
        
        emit SupplyCapAdded(_supplyCap, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Remove the supply cap to allow unlimited minting
     */
    function removeSupplyCap() external onlyRole(DEFAULT_ADMIN_ROLE) {
        supplyCapActive = false;
        emit SupplyCapRemoved(block.timestamp, msg.sender);
    }
    
    /**
     * @dev Get total minted tokens (including burned ones)
     * @return The total amount of tokens ever minted
     */
    function getTotalMinted() external view returns (uint256) {
        return totalMinted;
    }
    
    /**
     * @dev Helper function to get the current circulation status
     * @return current The current total supply
     * @return minted The total amount of tokens ever minted
     * @return capActive Whether a supply cap is currently active
     * @return cap The current supply cap (only relevant if capActive is true)
     */
    function getCirculationStatus() external view returns (uint256 current, uint256 minted, bool capActive, uint256 cap) {
        return (totalSupply(), totalMinted, supplyCapActive, supplyCap);
    }
}