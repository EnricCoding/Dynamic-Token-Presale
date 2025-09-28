// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMyToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

/// @title DynamicPresale - Dynamic Token Presale Contract
/// @notice Handles multi-phase presale, buy, claim, refund, and withdraw logic
contract DynamicPresale is ReentrancyGuard, Pausable, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Address for address payable;

    struct Phase {
        uint256 priceWei; // price per token unit in wei
        uint256 supply;   // tokens available in this phase (token units)
        uint256 sold;     // tokens sold in this phase (token units)
        uint256 start;    // unix timestamp
        uint256 end;      // unix timestamp
    }

    IMyToken public immutable token;
    uint8 public immutable tokenDecimals;
    uint256 public immutable tokenUnit; // 10 ** tokenDecimals

    // configurable sale parameters (owner-settable)
    uint256 public softCap;      // wei
    uint256 public minBuy;       // wei
    uint256 public maxPerWallet; // wei

    Phase[] public phases;

    uint256 public totalRaised;     // wei accepted (costs accepted)
    uint256 public totalTokensSold; // token units sold
    bool public saleEnded;
    bool public softCapReached;

    mapping(address => uint256) public contributionsWei; // wei accepted per buyer
    mapping(address => uint256) public pendingTokens;    // token units pending to be claimed
    EnumerableSet.AddressSet private buyers;

    // local escrow (pull-payment) mapping: recipient => wei pending
    mapping(address => uint256) private _escrowPayments;

    event Purchased(address indexed buyer, uint256 indexed phaseId, uint256 ethAmount, uint256 tokensAmount);
    event Claimed(address indexed buyer, uint256 tokensAmount);
    event RefundRequested(address indexed buyer, uint256 ethAmount);
    event PhaseAdded(uint256 indexed phaseId, uint256 priceWei, uint256 supply, uint256 start, uint256 end);
    event SoftCapReached(uint256 totalRaised);
    event Withdrawn(address indexed beneficiary, uint256 amount);
    event SaleEnded(bool softCapReached);
    event PaymentsWithdrawn(address indexed payee, uint256 amount);

    modifier onlyWhileActive() {
        require(!saleEnded, "Presale: sale ended");
        _;
    }

    /// @notice Constructor sets token, decimals and initial sale params
    /// NOTE: Ownable requires an initial owner parameter in OZ v5, por eso pasamos msg.sender.
    constructor(
        address token_,
        uint8 tokenDecimals_,
        uint256 softCap_,
        uint256 minBuy_,
        uint256 maxPerWallet_
    ) Ownable(msg.sender) {
        require(token_ != address(0), "Presale: token address zero");
        require(softCap_ > 0, "Presale: softCap must be > 0");
        require(minBuy_ > 0, "Presale: minBuy must be > 0");
        require(maxPerWallet_ >= minBuy_, "Presale: maxPerWallet must be >= minBuy");

        token = IMyToken(token_);
        tokenDecimals = tokenDecimals_;
        tokenUnit = 10 ** uint256(tokenDecimals_);
        softCap = softCap_;
        minBuy = minBuy_;
        maxPerWallet = maxPerWallet_;
    }
    // -------------------------
    // Pull-payment (local)
    // -------------------------

    /// @notice Internal helper to queue a payment for `dest` (pull pattern)
    function _asyncTransfer(address dest, uint256 amount) internal {
        require(dest != address(0), "Presale: dest zero");
        require(amount > 0, "Presale: zero amount");
        _escrowPayments[dest] += amount;
    }

    /// @notice Withdraw pending payments (excess/refund). Uses pull-pattern.
    function withdrawPayments() external nonReentrant {
        uint256 payment = _escrowPayments[msg.sender];
        require(payment > 0, "Presale: no payments");
        _escrowPayments[msg.sender] = 0;
        payable(msg.sender).transfer(payment);
        emit PaymentsWithdrawn(msg.sender, payment);
    }

    /// @notice View pending payments for an account
    function paymentsOf(address account) external view returns (uint256) {
        return _escrowPayments[account];
    }

    // -------------------------
    // Phase management
    // -------------------------

    /// @notice Add a new phase. Only owner can add.
    function addPhase(uint256 priceWei, uint256 supply, uint256 start, uint256 end) external onlyOwner {
        require(priceWei > 0, "Presale: price must be > 0");
        require(supply > 0, "Presale: supply must be > 0");
        require(start < end, "Presale: invalid phase time");

        // Disallow overlapping phases
        for (uint256 i = 0; i < phases.length; i++) {
            require(start >= phases[i].end || end <= phases[i].start, "Presale: overlapping phases");
        }

        phases.push(Phase({ priceWei: priceWei, supply: supply, sold: 0, start: start, end: end }));
        emit PhaseAdded(phases.length - 1, priceWei, supply, start, end);
    }

    /// @notice Update phase times for a future (not-yet-started) phase
    function updatePhase(uint256 phaseId, uint256 newStart, uint256 newEnd) external onlyOwner {
        require(phaseId < phases.length, "Presale: invalid phase ID");
        require(newStart < newEnd, "Presale: invalid phase time");
        Phase storage phase = phases[phaseId];
        require(block.timestamp < phase.start, "Presale: cannot update active/past phase");

        // Ensure no overlap with other phases
        for (uint256 i = 0; i < phases.length; i++) {
            if (i == phaseId) continue;
            require(newStart >= phases[i].end || newEnd <= phases[i].start, "Presale: overlapping phases");
        }

        phase.start = newStart;
        phase.end = newEnd;
    }

    /// @notice Pause a specific phase by setting its end time to now (emergency)
    function pausePhase(uint256 phaseId) external onlyOwner {
        require(phaseId < phases.length, "Presale: invalid phase ID");
        phases[phaseId].end = block.timestamp;
    }

    // -------------------------
    // Buy / Claim / Refund
    // -------------------------

    /// @notice Internal: find active phase index if any (non-reverting)
    function _currentPhaseIndex() internal view returns (bool, uint256) {
        for (uint256 i = 0; i < phases.length; i++) {
            Phase storage p = phases[i];
            bool timeOk = (p.start == 0 || block.timestamp >= p.start) && (p.end == 0 || block.timestamp <= p.end);
            bool hasSupply = p.sold < p.supply;
            if (timeOk && hasSupply) return (true, i);
        }
        return (false, 0);
    }

    /// @notice Buy tokens in current phase. Excess ETH will be queued for withdrawal via `withdrawPayments`.
    function buy() external payable nonReentrant whenNotPaused onlyWhileActive {
        require(msg.value >= minBuy, "Presale: below min buy");

        (bool found, uint256 phaseId) = _currentPhaseIndex();
        require(found, "Presale: no active phase");

        Phase storage phase = phases[phaseId];

        // Calculate tokens buyer can afford (in token units)
        uint256 tokensToBuy = (msg.value * tokenUnit) / phase.priceWei;
        require(tokensToBuy > 0, "Presale: zero tokens");

        uint256 available = phase.supply - phase.sold;
        uint256 tokensAllocated = tokensToBuy > available ? available : tokensToBuy;

        uint256 cost = (tokensAllocated * phase.priceWei) / tokenUnit;
        require(contributionsWei[msg.sender] + cost <= maxPerWallet, "Presale: above max per wallet");

        uint256 excess = msg.value - cost;

        // Effects (CEI)
        phase.sold += tokensAllocated;
        totalRaised += cost;
        totalTokensSold += tokensAllocated;
        contributionsWei[msg.sender] += cost;
        pendingTokens[msg.sender] += tokensAllocated;
        buyers.add(msg.sender);

        // Handle excess via pull (escrow)
        if (excess > 0) {
            _asyncTransfer(msg.sender, excess);
        }

        emit Purchased(msg.sender, phaseId, cost, tokensAllocated);

        if (!softCapReached && totalRaised >= softCap) {
            softCapReached = true;
            emit SoftCapReached(totalRaised);
        }
    }

    /// @notice Claim minted tokens after sale ended and soft cap reached
    function claim() external nonReentrant whenNotPaused {
        require(saleEnded, "Presale: sale not ended");
        require(softCapReached, "Presale: softCap not reached");

        uint256 amount = pendingTokens[msg.sender];
        require(amount > 0, "Presale: nothing to claim");

        pendingTokens[msg.sender] = 0;
        token.mint(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Request refund when sale ended and soft cap not reached
    function requestRefund() external nonReentrant whenNotPaused {
        require(saleEnded, "Presale: sale not ended");
        require(!softCapReached, "Presale: softCap reached");

        uint256 contributed = contributionsWei[msg.sender];
        require(contributed > 0, "Presale: nothing to refund");

        contributionsWei[msg.sender] = 0;
        pendingTokens[msg.sender] = 0;

        // Queue refund via pull pattern
        _asyncTransfer(msg.sender, contributed);
        emit RefundRequested(msg.sender, contributed);
    }

    // -------------------------
    // Admin actions
    // -------------------------

    /// @notice Withdraw proceeds (ETH held in contract) to beneficiary. Only owner and only when softCapReached and saleEnded.
    function withdrawProceeds(address payable beneficiary) external onlyOwner nonReentrant {
        require(saleEnded, "Presale: sale not ended");
        require(softCapReached, "Presale: softCap not reached");
        uint256 balance = address(this).balance;
        require(balance > 0, "Presale: nothing to withdraw");
        Address.sendValue(beneficiary, balance);
        emit Withdrawn(beneficiary, balance);
    }

    /// @notice End the sale. Only owner.
    function endSale() external onlyOwner {
        require(!saleEnded, "Presale: already ended");
        saleEnded = true;
        emit SaleEnded(softCapReached);
    }

    /// @notice Pause the presale (global). Only owner.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the presale (global). Only owner.
    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------------
    // View / helpers
    // -------------------------

    /// @notice Reverting current phase getter (keeps backward compatibility)
    function getCurrentPhase() public view returns (uint256) {
        for (uint256 i = 0; i < phases.length; i++) {
            if (block.timestamp >= phases[i].start && block.timestamp <= phases[i].end) {
                return i;
            }
        }
        revert("Presale: no active phase");
    }

    /// @notice Returns whether there is an active phase
    function hasActivePhase() external view returns (bool) {
        (bool found, ) = _currentPhaseIndex();
        return found;
    }

    /// @notice Get phase details
    function getPhase(uint256 phaseId) external view returns (Phase memory) {
        require(phaseId < phases.length, "Presale: invalid phase ID");
        return phases[phaseId];
    }

    /// @notice Total number of configured phases
    function totalPhases() external view returns (uint256) {
        return phases.length;
    }

    /// @notice Calculate tokens + cost + excess if buying `ethAmount` in current phase (safe, non-reverting)
    function calculateTokens(uint256 ethAmount) external view returns (uint256 tokens, uint256 cost, uint256 excess) {
        (bool found, uint256 phaseId) = _currentPhaseIndex();
        if (!found) return (0, 0, ethAmount);
        Phase memory phase = phases[phaseId];

        uint256 tokensToBuy = (ethAmount * tokenUnit) / phase.priceWei;
        uint256 available = phase.supply - phase.sold;
        uint256 tokensAllocated = tokensToBuy > available ? available : tokensToBuy;

        cost = (tokensAllocated * phase.priceWei) / tokenUnit;
        excess = ethAmount - cost;
        return (tokensAllocated, cost, excess);
    }

    /// @notice Remaining tokens in current phase (0 if none)
    function remainingTokensInCurrentPhase() external view returns (uint256) {
        (bool found, uint256 idx) = _currentPhaseIndex();
        if (!found) return 0;
        return phases[idx].supply - phases[idx].sold;
    }

    /// @notice Number of buyers (addresses) who participated
    function totalBuyers() external view returns (uint256) {
        return buyers.length();
    }

    // -------------------------
    // Admin setters (optional, owner-only)
    // -------------------------

    /// @notice Set soft cap (only until reached)
    function setSoftCap(uint256 newSoftCap) external onlyOwner {
        require(newSoftCap > 0, "Presale: softCap > 0");
        require(!softCapReached, "Presale: softCap already reached");
        softCap = newSoftCap;
    }

    /// @notice Set min buy
    function setMinBuy(uint256 newMinBuy) external onlyOwner {
        require(newMinBuy > 0, "Presale: minBuy > 0");
        require(newMinBuy <= maxPerWallet, "Presale: minBuy <= maxPerWallet");
        minBuy = newMinBuy;
    }

    /// @notice Set max per wallet
    function setMaxPerWallet(uint256 newMaxPerWallet) external onlyOwner {
        require(newMaxPerWallet >= minBuy, "Presale: maxPerWallet >= minBuy");
        maxPerWallet = newMaxPerWallet;
    }

    // Allow contract to receive ETH (for example direct transfers)
    receive() external payable {}
}
