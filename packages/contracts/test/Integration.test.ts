import { expect } from "chai";
import { ethers } from "hardhat";
import { DynamicPresale, MyToken, TokenVesting } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

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
      console.log("🚀 Starting Complete Presale Integration Test");

      // Phase 0: Early bird phase
      console.log("📅 Phase 0: Early bird buyers");
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
      
      console.log(`✅ Phase 0 raised: ${ethers.formatEther(totalRaisedPhase0)} ETH`);

      // Phase 1: Regular price phase
      console.log("📅 Phase 1: Regular price buyers");
      await time.increaseTo(phase1Start);
      
      const phase1Buy1 = ethers.parseEther("2.5"); // 2.5 ETH
      const phase1Buy2 = ethers.parseEther("4"); // 4 ETH
      
      await dynamicPresale.connect(buyer1).buy({ value: phase1Buy1 });
      await dynamicPresale.connect(buyer2).buy({ value: phase1Buy2 });

      // Check if soft cap reached (should be reached now)
      const totalRaisedPhase1 = totalRaisedPhase0 + phase1Buy1 + phase1Buy2;
      expect(await dynamicPresale.totalRaised()).to.equal(totalRaisedPhase1);
      expect(await dynamicPresale.softCapReached()).to.be.true;
      
      console.log(`✅ Phase 1 raised: ${ethers.formatEther(totalRaisedPhase1)} ETH - SoftCap Reached!`);

      // Phase 2: Premium price phase  
      console.log("📅 Phase 2: Premium price buyers");
      await time.increaseTo(phase2Start);
      
      const phase2Buy = ethers.parseEther("1"); // 1 ETH
      await dynamicPresale.connect(buyer3).buy({ value: phase2Buy });

      const totalRaisedFinal = totalRaisedPhase1 + phase2Buy;
      expect(await dynamicPresale.totalRaised()).to.equal(totalRaisedFinal);
      
      console.log(`✅ Final raised: ${ethers.formatEther(totalRaisedFinal)} ETH`);

      // End sale
      console.log("🏁 Ending sale");
      await dynamicPresale.endSale();
      expect(await dynamicPresale.saleEnded()).to.be.true;

      // Claim phase
      console.log("🎁 Claiming tokens");
      
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
      
      console.log(`✅ Buyer1 received: ${ethers.formatEther(buyer1PendingBefore)} tokens`);
      console.log(`✅ Buyer2 received: ${ethers.formatEther(buyer2PendingBefore)} tokens`);
      console.log(`✅ Buyer3 received: ${ethers.formatEther(buyer3PendingBefore)} tokens`);

      // Withdraw proceeds
      console.log("💰 Withdrawing proceeds to owner");
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await dynamicPresale.withdrawProceeds(owner.address);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      
      expect(ownerBalanceAfter - ownerBalanceBefore + gasUsed).to.equal(totalRaisedFinal);
      
      console.log(`✅ Owner received: ${ethers.formatEther(totalRaisedFinal)} ETH`);
      console.log("🎉 Complete presale flow executed successfully!");
    });
  });

  describe("Complete Failed Presale Flow (Refunds)", function () {
    it("Should handle failed presale with refunds correctly", async function () {
      console.log("🚨 Starting Failed Presale Integration Test");

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

      console.log(`📊 Total raised: ${ethers.formatEther(buy1 + buy2 + buy3)} ETH (softCap: ${ethers.formatEther(highSoftCap)} ETH)`);

      // End sale without reaching soft cap
      await failedPresale.endSale();
      expect(await failedPresale.softCapReached()).to.be.false;
      
      console.log("❌ Sale ended without reaching soft cap");

      // Request refunds
      console.log("💸 Processing refunds");
      
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
      
      console.log("✅ All refunds processed successfully");
      console.log("🎉 Failed presale flow handled correctly!");
    });
  });

  describe("Team and Advisor Vesting Integration", function () {
    it("Should integrate presale with team/advisor vesting", async function () {
      console.log("👥 Starting Team/Advisor Vesting Integration Test");

      // First, run successful presale
      await time.increaseTo(phase0Start);
      await dynamicPresale.connect(buyer1).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
      await dynamicPresale.connect(buyer1).claim();
      
      console.log("✅ Presale completed successfully");

      // Mint additional tokens for vesting
      const teamTokens = ethers.parseEther("10000"); // 10k tokens for team
      const advisorTokens = ethers.parseEther("5000"); // 5k tokens for advisor
      await myToken.mint(await tokenVesting.getAddress(), teamTokens + advisorTokens);
      
      console.log("💰 Additional tokens minted for vesting");

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
      
      console.log(`👨‍💼 Team vesting created: ${ethers.formatEther(teamTokens)} tokens`);

      // Create advisor vesting schedule
      await tokenVesting.createVesting(
        advisor.address,
        advisorTokens,
        vestingStart,
        ADVISOR_VESTING_DURATION,
        ADVISOR_CLIFF,
        false // not revocable
      );
      
      console.log(`🎯 Advisor vesting created: ${ethers.formatEther(advisorTokens)} tokens`);

      // Fast forward to after advisor cliff
      await time.increaseTo(vestingStart + ADVISOR_CLIFF + 1000);
      
      // Advisor should be able to release some tokens
      const advisorReleasable = await tokenVesting.getReleasableAmount(advisor.address, 0);
      expect(advisorReleasable).to.be.gt(0);
      
      await tokenVesting.connect(advisor).releaseSchedule(0);
      expect(await myToken.balanceOf(advisor.address)).to.equal(advisorReleasable);
      
      console.log(`🎯 Advisor released: ${ethers.formatEther(advisorReleasable)} tokens`);

      // Team member should not be able to release yet (longer cliff)
      const teamReleasable = await tokenVesting.getReleasableAmount(teamMember.address, 0);
      expect(teamReleasable).to.equal(0);
      
      console.log("👨‍💼 Team member cannot release yet (cliff not reached)");

      // Fast forward to after team cliff
      await time.increaseTo(vestingStart + TEAM_CLIFF + 1000);
      
      // Now team member should be able to release
      const teamReleasableAfterCliff = await tokenVesting.getReleasableAmount(teamMember.address, 0);
      expect(teamReleasableAfterCliff).to.be.gt(0);
      
      await tokenVesting.connect(teamMember).releaseSchedule(0);
      expect(await myToken.balanceOf(teamMember.address)).to.equal(teamReleasableAfterCliff);
      
      console.log(`👨‍💼 Team member released: ${ethers.formatEther(teamReleasableAfterCliff)} tokens`);

      // Test revoking team vesting (if needed)
      await tokenVesting.revokeVesting(teamMember.address, 0);
      const revokedSchedule = await tokenVesting.getSchedule(teamMember.address, 0);
      expect(revokedSchedule.revoked).to.be.true;
      
      console.log("🚫 Team vesting revoked (for example, if team member leaves)");
      console.log("🎉 Team/Advisor vesting integration completed!");
    });
  });

  describe("Multi-Phase Purchase Patterns", function () {
    it("Should handle complex buying patterns across phases", async function () {
      console.log("🔄 Testing Complex Multi-Phase Purchase Patterns");

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

      console.log("✅ Complex purchase patterns handled correctly");
    });

    it("Should handle phase supply exhaustion correctly", async function () {
      console.log("🏁 Testing Phase Supply Exhaustion");

      await time.increaseTo(phase0Start);
      
      // Calculate exact amount needed to exhaust phase 0
      const maxTokenCost = (PHASE_SUPPLY * PHASE_0_PRICE) / (10n ** BigInt(TOKEN_DECIMALS));
      
      // Buy most of the phase
      const firstBuy = maxTokenCost - ethers.parseEther("0.1");
      await dynamicPresale.connect(buyer1).buy({ value: firstBuy });
      
      // Buy remaining + excess (should get refund for excess)
      const excessBuy = ethers.parseEther("2"); // Way more than remaining
      await dynamicPresale.connect(buyer2).buy({ value: excessBuy });
      
      // Phase should be fully sold
      const phase0 = await dynamicPresale.getPhase(0);
      expect(phase0.sold).to.equal(PHASE_SUPPLY);
      
      // Buyer2 should have received only what was available
      const buyer2Tokens = await dynamicPresale.pendingTokens(buyer2.address);
      const remainingTokens = PHASE_SUPPLY - ((firstBuy * (10n ** BigInt(TOKEN_DECIMALS))) / PHASE_0_PRICE);
      expect(buyer2Tokens).to.equal(remainingTokens);
      
      console.log("✅ Phase supply exhaustion handled with proper refunds");
    });
  });

  describe("Emergency Scenarios", function () {
    it("Should handle emergency pause and unpause", async function () {
      console.log("🚨 Testing Emergency Pause Scenarios");

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
      
      console.log("✅ Emergency pause/unpause handled correctly");
    });

    it("Should handle token contract pause during claim", async function () {
      console.log("🚨 Testing Token Contract Pause During Claim");

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
      
      console.log("✅ Token pause during claim handled correctly");
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should have reasonable gas costs for common operations", async function () {
      console.log("⛽ Testing Gas Optimization");

      await time.increaseTo(phase0Start);
      
      // Test buy gas cost
      const buyTx = await dynamicPresale.connect(buyer1).buy({ value: ethers.parseEther("1") });
      const buyReceipt = await buyTx.wait();
      console.log(`💨 Buy gas used: ${buyReceipt!.gasUsed.toString()}`);
      expect(Number(buyReceipt!.gasUsed)).to.be.lt(200000); // Should be under 200k gas
      
      // Complete presale
      await dynamicPresale.connect(buyer2).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
      
      // Test claim gas cost
      const claimTx = await dynamicPresale.connect(buyer1).claim();
      const claimReceipt = await claimTx.wait();
      console.log(`💨 Claim gas used: ${claimReceipt!.gasUsed.toString()}`);
      expect(Number(claimReceipt!.gasUsed)).to.be.lt(150000); // Should be under 150k gas
      
      console.log("✅ Gas costs are within acceptable ranges");
    });
  });

  describe("Real-World Usage Patterns", function () {
    it("Should simulate realistic presale scenario", async function () {
      console.log("🌍 Simulating Real-World Presale Scenario");

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
      
      console.log("✅ Real-world scenario simulation completed successfully");
      
      // Log final statistics
      const totalRaised = await dynamicPresale.totalRaised();
      const totalBuyers = await dynamicPresale.totalBuyers();
      const totalTokensSold = await dynamicPresale.totalTokensSold();
      
      console.log(`📊 Final Statistics:`);
      console.log(`   💰 Total Raised: ${ethers.formatEther(totalRaised)} ETH`);
      console.log(`   👥 Total Buyers: ${totalBuyers}`);
      console.log(`   🪙 Total Tokens Sold: ${ethers.formatEther(totalTokensSold)} tokens`);
    });
  });
});