// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title MyToken - Professional ERC20 Token for Dynamic Presale
/// @notice Implements minting, burning, pausing, capping and role-based access control
/// @dev Uses AccessControl for granular permissions, supports capped supply (cap must be > 0)
contract MyToken is ERC20, ERC20Burnable, ERC20Capped, Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Emitted when admin performs an emergency burn from an account
    event EmergencyBurn(address indexed from, uint256 amount, address indexed admin);

    /// @notice Constructor sets name, symbol, cap and initial admin
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param cap_ Maximum supply cap (must be > 0). If you need an unlimited supply, do not inherit ERC20Capped.
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 cap_
    ) ERC20(name_, symbol_) ERC20Capped(cap_) {
        // ERC20Capped's constructor already requires cap_ > 0 (OpenZeppelin).
        // Keep logic explicit.
        require(cap_ > 0, "MyToken: cap is 0");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    /// @notice Mint new tokens to an address. Only accounts with MINTER_ROLE can mint.
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint (in base units)
    function mint(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "MyToken: mint to zero address");
        require(amount > 0, "MyToken: mint amount must be > 0");
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

    /// @notice Burn tokens from caller (inherited from ERC20Burnable).
    /// @dev keep default ERC20Burnable.burn semantics

    /// @notice Allow addresses with BURNER_ROLE to burn tokens from an address without allowance checks.
    /// @dev This is an admin-style burn for operators with the role.
    function burnFromByRole(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        require(from != address(0), "MyToken: burn from zero address");
        _burn(from, amount);
    }

    /// @notice Emergency burn function for admin. Only DEFAULT_ADMIN_ROLE.
    /// @param from Address to burn from
    /// @param amount Amount to burn
    function emergencyBurn(
        address from,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(from != address(0), "MyToken: burn from zero address");
        _burn(from, amount);
        emit EmergencyBurn(from, amount, msg.sender);
    }

    /// @dev Override _update to respect pause state (OpenZeppelin v5)
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Capped) whenNotPaused {
        super._update(from, to, value);
    }

    /// @dev Required override for AccessControl (ERC165)
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
