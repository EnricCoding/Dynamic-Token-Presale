// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title MyToken - Professional ERC20 Token for Dynamic Presale
/// @notice Implements minting, burning, pausing, capping and role-based access control
/// @dev Uses AccessControl for granular permissions, supports capped supply
contract MyToken is ERC20, ERC20Burnable, ERC20Capped, Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Constructor sets name, symbol, cap and initial admin
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param cap_ Maximum supply cap (use 0 for unlimited)
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 cap_
    ) ERC20(name_, symbol_) ERC20Capped(cap_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    /// @notice Mint new tokens to an address. Only accounts with MINTER_ROLE can mint.
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint
    function mint(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "MyToken: mint to zero address");
        require(amount > 0, "MyToken: mint amount must be greater than 0");
        _mint(to, amount);
    }

    /// @notice Pause all token transfers and minting. Only accounts with PAUSER_ROLE can pause.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpause token transfers and minting. Only accounts with PAUSER_ROLE can unpause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Burn tokens from a specific address. Only accounts with BURNER_ROLE can burn from others.
    /// @param from Address to burn tokens from
    /// @param amount Amount of tokens to burn
    function burnFrom(
        address from,
        uint256 amount
    ) public override onlyRole(BURNER_ROLE) {
        super.burnFrom(from, amount);
    }

    /// @notice Emergency burn function for admin. Only DEFAULT_ADMIN_ROLE.
    /// @param from Address to burn from
    /// @param amount Amount to burn
    function emergencyBurn(
        address from,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);
    }

    /// @dev Override _update to respect pause state (OpenZeppelin v5)
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Capped) whenNotPaused {
        super._update(from, to, value);
    }

    /// @dev Required override for AccessControl
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
