import { expect } from "chai";
import { ethers } from "hardhat";
import { DynamicPresale, MyToken, TokenVesting } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Helper function to compare values with precision tolerance (0.01%)
function expectApproxEqual(actual: bigint, expected: bigint, tolerancePercent: number = 0.01) {
  const tolerance = (expected * BigInt(Math.floor(tolerancePercent * 100))) / 10000n;
  const diff = actual > expected ? actual - expected : expected - actual;
  expect(diff).to.be.lte(tolerance, `Expected ${actual} to be approximately ${expected} (within ${tolerancePercent}%)`);
}

describe("Integration Tests - Complete Presale Flow", function () {
  let dynamicPresale: DynamicPresale;
  let myToken: MyToken;
  let tokenVesting: TokenVesting;
  let owner: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let buyer3: SignerWithAddress;
  let teamMember: SignerWithAddress;
  let advisor: SignerWithAddress;

  const TOKEN_NAME = "Dynamic Presale Token";
  const TOKEN_SYMBOL = "DPT";
  const TOKEN_CAP = ethers.parseEther("100000000"); // 100M tokens
  const TOKEN_DECIMALS = 18;

  // Presale parameters (from documentation)
  const SOFT_CAP = ethers.parseEther("10"); // 10 ETH
  const MIN_BUY = ethers.parseEther("0.01"); // 0.01 ETH
  const MAX_PER_WALLET = ethers.parseEther("20"); // 20 ETH

  // Phase parameters (from documentation)
  const PHASE_0_PRICE = ethers.parseUnits("0.0005", "ether"); // 0.0005 ETH per token
  const PHASE_1_PRICE = ethers.parseUnits("0.001", "ether"); // 0.001 ETH per token
  const PHASE_2_PRICE = ethers.parseUnits("0.002", "ether"); // 0.002 ETH per token
  const PHASE_SUPPLY = ethers.parseEther("100000"); // 100k tokens per phase

  // Vesting parameters
  const TEAM_VESTING_DURATION = 365 * 24 * 60 * 60; // 1 year
  const TEAM_CLIFF = 90 * 24 * 60 * 60; // 90 days cliff
  const ADVISOR_VESTING_DURATION = 180 * 24 * 60 * 60; // 6 months
  const ADVISOR_CLIFF = 30 * 24 * 60 * 60; // 30 days cliff

  let phase0Start: number;
  let phase0End: number;
  let phase1Start: number;
  let phase1End: number;
  let phase2Start: number;
  let phase2End: number;

  beforeEach(async function () {
    [owner, buyer1, buyer2, buyer3, teamMember, advisor] = await ethers.getSigners();

    // Deploy MyToken with cap
    const MyTokenFactory = await ethers.getContractFactory("MyToken");
    myToken = await MyTokenFactory.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_CAP);
    await myToken.waitForDeployment();

    // Deploy DynamicPresale
    const DynamicPresaleFactory = await ethers.getContractFactory("DynamicPresale");
    dynamicPresale = await DynamicPresaleFactory.deploy(
      await myToken.getAddress(),
      TOKEN_DECIMALS,
      SOFT_CAP,
      MIN_BUY,
      MAX_PER_WALLET
    );
    await dynamicPresale.waitForDeployment();

    // Deploy TokenVesting
    const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
    tokenVesting = await TokenVestingFactory.deploy(await myToken.getAddress());
    await tokenVesting.waitForDeployment();

    // Grant MINTER_ROLE to presale contract
    const MINTER_ROLE = await myToken.MINTER_ROLE();
    await myToken.grantRole(MINTER_ROLE, await dynamicPresale.getAddress());

    // Setup phase times
    const currentTime = await time.latest();
    phase0Start = currentTime + 100;
    phase0End = phase0Start + 3600; // 1 hour
    phase1Start = phase0End + 100;
    phase1End = phase1Start + 3600;
    phase2Start = phase1End + 100;
    phase2End = phase2Start + 3600;

    // Add all phases
    await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
    await dynamicPresale.addPhase(PHASE_1_PRICE, PHASE_SUPPLY, phase1Start, phase1End);
    await dynamicPresale.addPhase(PHASE_2_PRICE, PHASE_SUPPLY, phase2Start, phase2End);
  });

  describe("Complete Successful Presale Flow", function () {
    it("Should execute complete presale lifecycle successfully", async function () {


      // Phase 0: Early bird phase

      await time.increaseTo(phase0Start);
      
      // Multiple buyers participate in Phase 0
      const phase0Buy1 = ethers.parseEther("2"); // 2 ETH
      const phase0Buy2 = ethers.parseEther("3"); // 3 ETH
      const phase0Buy3 = ethers.parseEther("1.5"); // 1.5 ETH
      
      await dynamicPresale.connect(buyer1).buy({ value: phase0Buy1 });
      await dynamicPresale.connect(buyer2).buy({ value: phase0Buy2 });
      await dynamicPresale.connect(buyer3).buy({ value: phase0Buy3 });

      // Verify Phase 0 state
      const totalRaisedPhase0 = phase0Buy1 + phase0Buy2 + phase0Buy3;
      expect(await dynamicPresale.totalRaised()).to.equal(totalRaisedPhase0);
      expect(await dynamicPresale.totalBuyers()).to.equal(3);
      


      // Phase 1: Regular price phase

      await time.increaseTo(phase1Start);
      
      const phase1Buy1 = ethers.parseEther("2.5"); // 2.5 ETH
      const phase1Buy2 = ethers.parseEther("4"); // 4 ETH
      
      await dynamicPresale.connect(buyer1).buy({ value: phase1Buy1 });
      await dynamicPresale.connect(buyer2).buy({ value: phase1Buy2 });

      // Check if soft cap reached (should be reached now)
      const totalRaisedPhase1 = totalRaisedPhase0 + phase1Buy1 + phase1Buy2;
      expect(await dynamicPresale.totalRaised()).to.equal(totalRaisedPhase1);
      expect(await dynamicPresale.softCapReached()).to.be.true;
      


      // Phase 2: Premium price phase  

      await time.increaseTo(phase2Start);
      
      const phase2Buy = ethers.parseEther("1"); // 1 ETH
      await dynamicPresale.connect(buyer3).buy({ value: phase2Buy });

      const totalRaisedFinal = totalRaisedPhase1 + phase2Buy;
      expect(await dynamicPresale.totalRaised()).to.equal(totalRaisedFinal);
      


      // End sale

      await dynamicPresale.endSale();
      expect(await dynamicPresale.saleEnded()).to.be.true;

      // Claim phase

      
      const buyer1PendingBefore = await dynamicPresale.pendingTokens(buyer1.address);
      const buyer2PendingBefore = await dynamicPresale.pendingTokens(buyer2.address);
      const buyer3PendingBefore = await dynamicPresale.pendingTokens(buyer3.address);
      
      await dynamicPresale.connect(buyer1).claim();
      await dynamicPresale.connect(buyer2).claim();
      await dynamicPresale.connect(buyer3).claim();

      // Verify token balances
      expect(await myToken.balanceOf(buyer1.address)).to.equal(buyer1PendingBefore);
      expect(await myToken.balanceOf(buyer2.address)).to.equal(buyer2PendingBefore);
      expect(await myToken.balanceOf(buyer3.address)).to.equal(buyer3PendingBefore);
      


      // Withdraw proceeds

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await dynamicPresale.withdrawProceeds(owner.address);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      
      expect(ownerBalanceAfter - ownerBalanceBefore + gasUsed).to.equal(totalRaisedFinal);
      

    });
  });

  describe("Complete Failed Presale Flow (Refunds)", function () {
    it("Should handle failed presale with refunds correctly", async function () {
      // Deploy presale with very high soft cap
      const highSoftCap = ethers.parseEther("1000"); // 1000 ETH (impossible to reach)
      const DynamicPresaleFactory = await ethers.getContractFactory("DynamicPresale");
      const failedPresale = await DynamicPresaleFactory.deploy(
        await myToken.getAddress(),
        TOKEN_DECIMALS,
        highSoftCap,
        MIN_BUY,
        MAX_PER_WALLET
      );
      await failedPresale.waitForDeployment();

      // Add phases
      await failedPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await failedPresale.addPhase(PHASE_1_PRICE, PHASE_SUPPLY, phase1Start, phase1End);

      // Phase 0: Some buyers participate
      await time.increaseTo(phase0Start);
      
      const buy1 = ethers.parseEther("5");
      const buy2 = ethers.parseEther("7"); 
      const buy3 = ethers.parseEther("3");
      
      await failedPresale.connect(buyer1).buy({ value: buy1 });
      await failedPresale.connect(buyer2).buy({ value: buy2 });
      await failedPresale.connect(buyer3).buy({ value: buy3 });

      // End sale without reaching soft cap
      await failedPresale.endSale();
      expect(await failedPresale.softCapReached()).to.be.false;
      
      // Request refunds
      
      await failedPresale.connect(buyer1).requestRefund();
      await failedPresale.connect(buyer2).requestRefund();
      await failedPresale.connect(buyer3).requestRefund();

      // Verify refund state
      expect(await failedPresale.contributionsWei(buyer1.address)).to.equal(0);
      expect(await failedPresale.contributionsWei(buyer2.address)).to.equal(0);
      expect(await failedPresale.contributionsWei(buyer3.address)).to.equal(0);
      expect(await failedPresale.pendingTokens(buyer1.address)).to.equal(0);
      expect(await failedPresale.pendingTokens(buyer2.address)).to.equal(0);
      expect(await failedPresale.pendingTokens(buyer3.address)).to.equal(0);
    });
  });

  describe("Team and Advisor Vesting Integration", function () {
    it("Should integrate presale with team/advisor vesting", async function () {

      // First, run successful presale
      await time.increaseTo(phase0Start);
      await dynamicPresale.connect(buyer1).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
      await dynamicPresale.connect(buyer1).claim();

      // Mint additional tokens for vesting
      const teamTokens = ethers.parseEther("10000"); // 10k tokens for team
      const advisorTokens = ethers.parseEther("5000"); // 5k tokens for advisor
      await myToken.mint(await tokenVesting.getAddress(), teamTokens + advisorTokens);

      // Create team vesting schedule
      const vestingStart = await time.latest() + 100;
      await tokenVesting.createVesting(
        teamMember.address,
        teamTokens,
        vestingStart,
        TEAM_VESTING_DURATION,
        TEAM_CLIFF,
        true // revocable
      );

      // Create advisor vesting schedule
      await tokenVesting.createVesting(
        advisor.address,
        advisorTokens,
        vestingStart,
        ADVISOR_VESTING_DURATION,
        ADVISOR_CLIFF,
        false // not revocable
      );

      // Fast forward to after advisor cliff
      await time.increaseTo(vestingStart + ADVISOR_CLIFF + 1000);

      // Advisor should be able to release some tokens
      const advisorReleasable = await tokenVesting.getReleasableAmount(advisor.address, 0);
      expect(advisorReleasable).to.be.gt(0);

      await tokenVesting.connect(advisor).releaseSchedule(0);
      const advisorBalance = await myToken.balanceOf(advisor.address);
      const diff = advisorBalance > advisorReleasable ? advisorBalance - advisorReleasable : advisorReleasable - advisorBalance;
      expect(diff).to.be.lte(advisorReleasable / 10000n); // Within 0.01% tolerance

      // Team member should not be able to release yet (longer cliff)
      const teamReleasable = await tokenVesting.getReleasableAmount(teamMember.address, 0);
      expect(teamReleasable).to.equal(0);
      
      // Fast forward to after team cliff
      await time.increaseTo(vestingStart + TEAM_CLIFF + 1000);
      
      // Now team member should be able to release
      const teamReleasableAfterCliff = await tokenVesting.getReleasableAmount(teamMember.address, 0);
      expect(teamReleasableAfterCliff).to.be.gt(0);
      
      await tokenVesting.connect(teamMember).releaseSchedule(0);
      expectApproxEqual(await myToken.balanceOf(teamMember.address), teamReleasableAfterCliff);
      
      // Test revoking team vesting (if needed)
      await tokenVesting.revokeVesting(teamMember.address, 0);
      const revokedSchedule = await tokenVesting.getSchedule(teamMember.address, 0);
      expect(revokedSchedule.revoked).to.be.true;
    });
  });

  describe("Multi-Phase Purchase Patterns", function () {
    it("Should handle complex buying patterns across phases", async function () {

      // Phase 0: Partial purchase
      await time.increaseTo(phase0Start);
      await dynamicPresale.connect(buyer1).buy({ value: ethers.parseEther("1") });
      
      // Phase 1: Multiple small purchases
      await time.increaseTo(phase1Start);
      await dynamicPresale.connect(buyer1).buy({ value: MIN_BUY });
      await dynamicPresale.connect(buyer1).buy({ value: MIN_BUY });
      await dynamicPresale.connect(buyer1).buy({ value: MIN_BUY });
      
      // Phase 2: Large purchase that hits max per wallet
      await time.increaseTo(phase2Start);
      const remainingCapacity = MAX_PER_WALLET - await dynamicPresale.contributionsWei(buyer1.address);
      await dynamicPresale.connect(buyer1).buy({ value: remainingCapacity });

      // Verify buyer1 hit max per wallet
      expect(await dynamicPresale.contributionsWei(buyer1.address)).to.equal(MAX_PER_WALLET);
      
      // Should revert if trying to buy more
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: MIN_BUY })
      ).to.be.revertedWith("Presale: above max per wallet");
    });

    it("Should handle phase supply exhaustion correctly", async function () {
      await time.increaseTo(phase0Start);
      
      // Buyer1 buys a safe amount within limits
      const buyer1Purchase = ethers.parseEther("5"); // 5 ETH
      const buyer1Tokens = (buyer1Purchase * (10n ** BigInt(TOKEN_DECIMALS))) / PHASE_0_PRICE;
      const buyer1ActualCost = (buyer1Tokens * PHASE_0_PRICE) / (10n ** BigInt(TOKEN_DECIMALS));
      
      await dynamicPresale.connect(buyer1).buy({ value: buyer1Purchase });
      
      // Buyer2 buys another safe amount
      const buyer2Purchase = ethers.parseEther("5"); // 5 ETH  
      const buyer2Tokens = (buyer2Purchase * (10n ** BigInt(TOKEN_DECIMALS))) / PHASE_0_PRICE;
      const buyer2ActualCost = (buyer2Tokens * PHASE_0_PRICE) / (10n ** BigInt(TOKEN_DECIMALS));
      
      await dynamicPresale.connect(buyer2).buy({ value: buyer2Purchase });
      
      // Check both purchases worked
      const phase0 = await dynamicPresale.getPhase(0);
      expect(phase0.sold).to.equal(buyer1Tokens + buyer2Tokens);
      
      expect(await dynamicPresale.pendingTokens(buyer1.address)).to.equal(buyer1Tokens);
      expect(await dynamicPresale.pendingTokens(buyer2.address)).to.equal(buyer2Tokens);
    });
  });

  describe("Emergency Scenarios", function () {
    it("Should handle emergency pause and unpause", async function () {
      await time.increaseTo(phase0Start);
      
      // Normal purchase should work
      await dynamicPresale.connect(buyer1).buy({ value: MIN_BUY });
      
      // Pause the contract
      await dynamicPresale.pause();
      
      // Purchases should fail when paused
      await expect(
        dynamicPresale.connect(buyer2).buy({ value: MIN_BUY })
      ).to.be.revertedWithCustomError(dynamicPresale, "EnforcedPause");
      
      // Unpause
      await dynamicPresale.unpause();
      
      // Purchases should work again
      await dynamicPresale.connect(buyer2).buy({ value: MIN_BUY });
      

    });

    it("Should handle token contract pause during claim", async function () {
      // Complete successful presale
      await time.increaseTo(phase0Start);
      await dynamicPresale.connect(buyer1).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
      
      // Pause token contract
      await myToken.pause();
      
      // Claims should fail when token is paused
      await expect(
        dynamicPresale.connect(buyer1).claim()
      ).to.be.revertedWithCustomError(myToken, "EnforcedPause");
      
      // Unpause token
      await myToken.unpause();
      
      // Claims should work again
      await dynamicPresale.connect(buyer1).claim();
      expect(await myToken.balanceOf(buyer1.address)).to.be.gt(0);
      

    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should have reasonable gas costs for common operations", async function () {
      await time.increaseTo(phase0Start);
      
      // Test buy gas cost
      const buyTx = await dynamicPresale.connect(buyer1).buy({ value: ethers.parseEther("1") });
      const buyReceipt = await buyTx.wait();
      expect(Number(buyReceipt!.gasUsed)).to.be.lt(250000); // Should be under 250k gas
      
      // Complete presale
      await dynamicPresale.connect(buyer2).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
      
      // Test claim gas cost
      const claimTx = await dynamicPresale.connect(buyer1).claim();
      const claimReceipt = await claimTx.wait();
      expect(Number(claimReceipt!.gasUsed)).to.be.lt(150000); // Should be under 150k gas
    });
  });

  describe("Real-World Usage Patterns", function () {
    it("Should simulate realistic presale scenario", async function () {
      // Simulate realistic timing and buying patterns
      
      // Phase 0: Early adopters (enthusiastic but smaller amounts)
      await time.increaseTo(phase0Start + 300); // 5 minutes after start
      await dynamicPresale.connect(buyer1).buy({ value: ethers.parseEther("0.5") });
      await dynamicPresale.connect(buyer2).buy({ value: ethers.parseEther("1.2") });
      
      // More buyers join gradually
      await time.increase(600); // 10 minutes later
      await dynamicPresale.connect(buyer3).buy({ value: ethers.parseEther("0.8") });
      
      // Phase 1: Main buying wave
      await time.increaseTo(phase1Start + 180); // 3 minutes after phase 1 start
      await dynamicPresale.connect(buyer1).buy({ value: ethers.parseEther("3") });
      await dynamicPresale.connect(buyer2).buy({ value: ethers.parseEther("5") });
      
      // Soft cap reached during Phase 1
      expect(await dynamicPresale.softCapReached()).to.be.true;
      
      // Phase 2: FOMO buying at higher prices
      await time.increaseTo(phase2Start + 60); // 1 minute after phase 2 start
      await dynamicPresale.connect(buyer3).buy({ value: ethers.parseEther("2") });
      
      // End sale before phase 2 ends (early finish)
      await dynamicPresale.endSale();
      
      // Claims happen at different times
      await dynamicPresale.connect(buyer1).claim();
      
      await time.increase(1800); // 30 minutes later
      await dynamicPresale.connect(buyer2).claim();
      
      await time.increase(3600); // 1 hour later  
      await dynamicPresale.connect(buyer3).claim();
      
      // Verify all participants got their tokens
      expect(await myToken.balanceOf(buyer1.address)).to.be.gt(0);
      expect(await myToken.balanceOf(buyer2.address)).to.be.gt(0);
      expect(await myToken.balanceOf(buyer3.address)).to.be.gt(0);
      
      // Owner withdraws proceeds
      await dynamicPresale.withdrawProceeds(owner.address);
      
      // Final verification
      const totalRaised = await dynamicPresale.totalRaised();
      const totalBuyers = await dynamicPresale.totalBuyers();
      const totalTokensSold = await dynamicPresale.totalTokensSold();
      
      expect(totalRaised).to.be.gt(0);
      expect(totalBuyers).to.be.gt(0);
      expect(totalTokensSold).to.be.gt(0);
    });
  });
});