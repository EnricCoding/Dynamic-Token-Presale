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
    uint256 public immutable tokenUnit;

    uint256 public softCap;     
    uint256 public minBuy;      
    uint256 public maxPerWallet; 

    Phase[] public phases;

    uint256 public totalRaised;    
    uint256 public totalTokensSold; 
    bool public saleEnded;
    bool public softCapReached;

    mapping(address => uint256) public contributionsWei;
    mapping(address => uint256) public pendingTokens;   
    EnumerableSet.AddressSet private buyers;

    mapping(address => uint256) private _escrowPayments;

    uint256 public totalEscrow;

    event Purchased(address indexed buyer, uint256 indexed phaseId, uint256 ethAmount, uint256 tokensAmount);
    event Claimed(address indexed buyer, uint256 tokensAmount);
    event RefundRequested(address indexed buyer, uint256 ethAmount);
    event PaymentQueued(address indexed dest, uint256 amount);
    event PhaseAdded(uint256 indexed phaseId, uint256 priceWei, uint256 supply, uint256 start, uint256 end);
    event SoftCapReached(uint256 totalRaised);
    event Withdrawn(address indexed beneficiary, uint256 amount);
    event SaleEnded(bool softCapReached);
    event PaymentsWithdrawn(address indexed payee, uint256 amount);

    modifier onlyWhileActive() {
        require(!saleEnded, "Presale: sale ended");
        _;
    }

    constructor(
        address token_,
        uint8 tokenDecimals_,
        uint256 softCap_,
        uint256 minBuy_,
        uint256 maxPerWallet_
    ) Ownable(msg.sender) {
        require(token_ != address(0), "Presale: token address zero");
        require(softCap_ > 0, "Presale: softCap must be greater than 0");
        require(minBuy_ > 0, "Presale: minBuy must be greater than 0");
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

    function _asyncTransfer(address dest, uint256 amount) internal {
        require(dest != address(0), "Presale: dest zero");
        require(amount > 0, "Presale: zero amount");
        _escrowPayments[dest] += amount;
        totalEscrow += amount;
        emit PaymentQueued(dest, amount);
    }

    function withdrawPayments() external nonReentrant {
        uint256 payment = _escrowPayments[msg.sender];
        require(payment > 0, "Presale: no payments");

        _escrowPayments[msg.sender] = 0;
        if (totalEscrow >= payment) {
            totalEscrow -= payment;
        } else {
            totalEscrow = 0;
        }

        Address.sendValue(payable(msg.sender), payment);
        emit PaymentsWithdrawn(msg.sender, payment);
    }

    function paymentsOf(address account) external view returns (uint256) {
        return _escrowPayments[account];
    }

    function escrowBalance() external view returns (uint256) {
        return totalEscrow;
    }

    // -------------------------
    // Phase management
    // -------------------------

    function addPhase(uint256 priceWei, uint256 supply, uint256 start, uint256 end) external onlyOwner {
        require(priceWei > 0, "Presale: price must be greater than 0");
        require(supply > 0, "Presale: supply must be greater than 0");
        require(start < end, "Presale: invalid phase time");
        require(start > block.timestamp, "Presale: start time must be in future");

        for (uint256 i = 0; i < phases.length; i++) {
            require(start >= phases[i].end || end <= phases[i].start, "Presale: overlapping phases");
        }

        phases.push(Phase({ priceWei: priceWei, supply: supply, sold: 0, start: start, end: end }));
        emit PhaseAdded(phases.length - 1, priceWei, supply, start, end);
    }

    function updatePhase(uint256 phaseId, uint256 newStart, uint256 newEnd) external onlyOwner {
        require(phaseId < phases.length, "Presale: invalid phase ID");
        require(newStart < newEnd, "Presale: invalid phase time");
        Phase storage phase = phases[phaseId];
        require(block.timestamp < phase.start, "Presale: cannot update active/past phase");

        for (uint256 i = 0; i < phases.length; i++) {
            if (i == phaseId) continue;
            require(newStart >= phases[i].end || newEnd <= phases[i].start, "Presale: overlapping phases");
        }

        phase.start = newStart;
        phase.end = newEnd;
    }

    function pausePhase(uint256 phaseId) external onlyOwner {
        require(phaseId < phases.length, "Presale: invalid phase ID");
        phases[phaseId].end = block.timestamp;
    }

    // -------------------------
    // Buy / Claim / Refund
    // -------------------------

    function _currentPhaseIndex() internal view returns (bool, uint256) {
        for (uint256 i = 0; i < phases.length; i++) {
            Phase storage p = phases[i];
            bool timeOk = (p.start == 0 || block.timestamp >= p.start) && (p.end == 0 || block.timestamp <= p.end);
            bool hasSupply = p.sold < p.supply;
            if (timeOk && hasSupply) return (true, i);
        }
        return (false, 0);
    }

    function buy() external payable nonReentrant whenNotPaused onlyWhileActive {
        require(msg.value >= minBuy, "Presale: below min buy");

        (bool found, uint256 phaseId) = _currentPhaseIndex();
        require(found, "Presale: no active phase");

        Phase storage phase = phases[phaseId];

        uint256 tokensToBuy = (msg.value * tokenUnit) / phase.priceWei;
        require(tokensToBuy > 0, "Presale: zero tokens");

        uint256 available = phase.supply - phase.sold;
        uint256 tokensAllocated = tokensToBuy > available ? available : tokensToBuy;

        uint256 cost = (tokensAllocated * phase.priceWei) / tokenUnit;
        require(contributionsWei[msg.sender] + cost <= maxPerWallet, "Presale: above max per wallet");

        uint256 excess = msg.value - cost;

        phase.sold += tokensAllocated;
        totalRaised += cost;
        totalTokensSold += tokensAllocated;
        contributionsWei[msg.sender] += cost;
        pendingTokens[msg.sender] += tokensAllocated;
        buyers.add(msg.sender);

        if (excess > 0) {
            _asyncTransfer(msg.sender, excess);
        }

        emit Purchased(msg.sender, phaseId, cost, tokensAllocated);

        if (!softCapReached && totalRaised >= softCap) {
            softCapReached = true;
            emit SoftCapReached(totalRaised);
        }
    }

    function claim() external nonReentrant whenNotPaused {
        require(saleEnded, "Presale: sale not ended");
        require(softCapReached, "Presale: softCap not reached");

        uint256 amount = pendingTokens[msg.sender];
        require(amount > 0, "Presale: nothing to claim");

        pendingTokens[msg.sender] = 0;
        token.mint(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function requestRefund() external nonReentrant whenNotPaused {
        require(saleEnded, "Presale: sale not ended");
        require(!softCapReached, "Presale: softCap reached");

        uint256 contributed = contributionsWei[msg.sender];
        require(contributed > 0, "Presale: nothing to refund");

        contributionsWei[msg.sender] = 0;
        pendingTokens[msg.sender] = 0;

        _asyncTransfer(msg.sender, contributed);
        emit RefundRequested(msg.sender, contributed);
    }

    // -------------------------
    // Admin actions
    // -------------------------

    function withdrawProceeds(address payable beneficiary) external onlyOwner nonReentrant {
        require(saleEnded, "Presale: sale not ended");
        require(softCapReached, "Presale: softCap not reached");

        uint256 currentBalance = address(this).balance;
        require(currentBalance > totalEscrow, "Presale: nothing withdrawable (reserved escrow)");
        uint256 withdrawable = currentBalance - totalEscrow;
        Address.sendValue(beneficiary, withdrawable);
        emit Withdrawn(beneficiary, withdrawable);
    }

    function endSale() external onlyOwner {
        require(!saleEnded, "Presale: already ended");
        saleEnded = true;
        emit SaleEnded(softCapReached);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------------
    // View / helpers
    // -------------------------

    function getCurrentPhase() public view returns (uint256) {
        for (uint256 i = 0; i < phases.length; i++) {
            if (block.timestamp >= phases[i].start && block.timestamp <= phases[i].end) {
                return i;
            }
        }
        revert("Presale: no active phase");
    }

    function hasActivePhase() external view returns (bool) {
        (bool found, ) = _currentPhaseIndex();
        return found;
    }

    function getPhase(uint256 phaseId) external view returns (Phase memory) {
        require(phaseId < phases.length, "Presale: invalid phase ID");
        return phases[phaseId];
    }

    function totalPhases() external view returns (uint256) {
        return phases.length;
    }

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

    function remainingTokensInCurrentPhase() external view returns (uint256) {
        (bool found, uint256 idx) = _currentPhaseIndex();
        if (!found) return 0;
        return phases[idx].supply - phases[idx].sold;
    }

    function totalBuyers() external view returns (uint256) {
        return buyers.length();
    }

    // -------------------------
    // Admin setters (optional, owner-only)
    // -------------------------

    function setSoftCap(uint256 newSoftCap) external onlyOwner {
        require(newSoftCap > 0, "Presale: softCap > 0");
        require(!softCapReached, "Presale: softCap already reached");
        softCap = newSoftCap;
    }

    function setMinBuy(uint256 newMinBuy) external onlyOwner {
        require(newMinBuy > 0, "Presale: minBuy > 0");
        require(newMinBuy <= maxPerWallet, "Presale: minBuy <= maxPerWallet");
        minBuy = newMinBuy;
    }

    function setMaxPerWallet(uint256 newMaxPerWallet) external onlyOwner {
        require(newMaxPerWallet >= minBuy, "Presale: maxPerWallet >= minBuy");
        maxPerWallet = newMaxPerWallet;
    }

    receive() external payable {}
}
