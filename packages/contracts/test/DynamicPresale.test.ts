import { expect } from "chai";
import { ethers } from "hardhat";
import { DynamicPresale, MyToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DynamicPresale", function () {
  let dynamicPresale: DynamicPresale;
  let myToken: MyToken;
  let owner: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let buyer3: SignerWithAddress;
  let beneficiary: SignerWithAddress;

  const TOKEN_NAME = "Dynamic Presale Token";
  const TOKEN_SYMBOL = "DPT";
  const TOKEN_CAP = ethers.parseEther("100000000"); // 100M tokens
  const TOKEN_DECIMALS = 18;

  // Presale parameters
  const SOFT_CAP = ethers.parseEther("10"); // 10 ETH
  const MIN_BUY = ethers.parseEther("0.01"); // 0.01 ETH
  const MAX_PER_WALLET = ethers.parseEther("20"); // 20 ETH

  // Phase parameters
  const PHASE_0_PRICE = ethers.parseEther("0.0005"); // 0.0005 ETH per token
  const PHASE_1_PRICE = ethers.parseEther("0.001"); // 0.001 ETH per token
  const PHASE_2_PRICE = ethers.parseEther("0.002"); // 0.002 ETH per token
  const PHASE_SUPPLY = ethers.parseEther("100000"); // 100k tokens per phase

  let phase0Start: number;
  let phase0End: number;
  let phase1Start: number;
  let phase1End: number;
  let phase2Start: number;
  let phase2End: number;

  beforeEach(async function () {
    [owner, buyer1, buyer2, buyer3, beneficiary] = await ethers.getSigners();

    // Deploy MyToken
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
  });

  describe("Deployment", function () {
    it("Should set the right parameters", async function () {
      expect(await dynamicPresale.token()).to.equal(await myToken.getAddress());
      expect(await dynamicPresale.tokenDecimals()).to.equal(TOKEN_DECIMALS);
      expect(await dynamicPresale.softCap()).to.equal(SOFT_CAP);
      expect(await dynamicPresale.minBuy()).to.equal(MIN_BUY);
      expect(await dynamicPresale.maxPerWallet()).to.equal(MAX_PER_WALLET);
    });

    it("Should set tokenUnit correctly", async function () {
      const expectedTokenUnit = 10n ** BigInt(TOKEN_DECIMALS);
      expect(await dynamicPresale.tokenUnit()).to.equal(expectedTokenUnit);
    });

    it("Should start with sale not ended", async function () {
      expect(await dynamicPresale.saleEnded()).to.be.false;
      expect(await dynamicPresale.softCapReached()).to.be.false;
    });

    it("Should revert with invalid parameters", async function () {
      const DynamicPresaleFactory = await ethers.getContractFactory("DynamicPresale");
      
      // Zero token address
      await expect(
        DynamicPresaleFactory.deploy(ethers.ZeroAddress, TOKEN_DECIMALS, SOFT_CAP, MIN_BUY, MAX_PER_WALLET)
      ).to.be.revertedWith("Presale: token address zero");

      // Zero soft cap
      await expect(
        DynamicPresaleFactory.deploy(await myToken.getAddress(), TOKEN_DECIMALS, 0, MIN_BUY, MAX_PER_WALLET)
      ).to.be.revertedWith("Presale: softCap must be greater than 0");

      // Zero min buy
      await expect(
        DynamicPresaleFactory.deploy(await myToken.getAddress(), TOKEN_DECIMALS, SOFT_CAP, 0, MAX_PER_WALLET)
      ).to.be.revertedWith("Presale: minBuy must be greater than 0");

      // Max per wallet less than min buy
      await expect(
        DynamicPresaleFactory.deploy(await myToken.getAddress(), TOKEN_DECIMALS, SOFT_CAP, MAX_PER_WALLET, MIN_BUY)
      ).to.be.revertedWith("Presale: maxPerWallet must be >= minBuy");
    });
  });

  describe("Phase Management", function () {
    it("Should add phase correctly", async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      
      const phase = await dynamicPresale.getPhase(0);
      expect(phase.priceWei).to.equal(PHASE_0_PRICE);
      expect(phase.supply).to.equal(PHASE_SUPPLY);
      expect(phase.sold).to.equal(0);
      expect(phase.start).to.equal(phase0Start);
      expect(phase.end).to.equal(phase0End);

      expect(await dynamicPresale.totalPhases()).to.equal(1);
    });

    it("Should emit PhaseAdded event", async function () {
      await expect(
        dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End)
      ).to.emit(dynamicPresale, "PhaseAdded")
        .withArgs(0, PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
    });

    it("Should revert with invalid phase parameters", async function () {
      // Zero price
      await expect(
        dynamicPresale.addPhase(0, PHASE_SUPPLY, phase0Start, phase0End)
      ).to.be.revertedWith("Presale: price must be greater than 0");

      // Zero supply
      await expect(
        dynamicPresale.addPhase(PHASE_0_PRICE, 0, phase0Start, phase0End)
      ).to.be.revertedWith("Presale: supply must be greater than 0");

      // Invalid time range
      await expect(
        dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0End, phase0Start)
      ).to.be.revertedWith("Presale: invalid phase time");

      // Start time in past
      const pastTime = (await time.latest()) - 100;
      await expect(
        dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, pastTime, phase0End)
      ).to.be.revertedWith("Presale: start time must be in future");
    });

    it("Should prevent overlapping phases", async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      
      // Overlapping phase
      await expect(
        dynamicPresale.addPhase(PHASE_1_PRICE, PHASE_SUPPLY, phase0Start + 1800, phase0End + 1800)
      ).to.be.revertedWith("Presale: overlapping phases");
    });

    it("Should allow non-overlapping phases", async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await dynamicPresale.addPhase(PHASE_1_PRICE, PHASE_SUPPLY, phase1Start, phase1End);
      
      expect(await dynamicPresale.totalPhases()).to.equal(2);
    });

    it("Should only allow owner to add phases", async function () {
      await expect(
        dynamicPresale.connect(buyer1).addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End)
      ).to.be.revertedWithCustomError(dynamicPresale, "OwnableUnauthorizedAccount");
    });
  });

  describe("Buying Tokens", function () {
    beforeEach(async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await time.increaseTo(phase0Start);
    });

    it("Should allow buying tokens", async function () {
      const buyAmount = ethers.parseEther("1"); // 1 ETH
      const expectedTokens = (buyAmount * (10n ** BigInt(TOKEN_DECIMALS))) / PHASE_0_PRICE;
      
      await dynamicPresale.connect(buyer1).buy({ value: buyAmount });
      
      expect(await dynamicPresale.contributionsWei(buyer1.address)).to.equal(buyAmount);
      expect(await dynamicPresale.pendingTokens(buyer1.address)).to.equal(expectedTokens);
      expect(await dynamicPresale.totalRaised()).to.equal(buyAmount);
      expect(await dynamicPresale.totalTokensSold()).to.equal(expectedTokens);
    });

    it("Should emit Purchased event", async function () {
      const buyAmount = ethers.parseEther("1");
      const expectedTokens = (buyAmount * (10n ** BigInt(TOKEN_DECIMALS))) / PHASE_0_PRICE;
      
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: buyAmount })
      ).to.emit(dynamicPresale, "Purchased")
        .withArgs(buyer1.address, 0, buyAmount, expectedTokens);
    });

    it("Should handle excess ETH correctly", async function () {
      // Buy more than available in phase
      const remainingSupply = PHASE_SUPPLY;
      const maxTokenCost = (remainingSupply * PHASE_0_PRICE) / (10n ** BigInt(TOKEN_DECIMALS));
      const buyAmount = maxTokenCost + ethers.parseEther("1"); // 1 ETH excess
      
      const tx = await dynamicPresale.connect(buyer1).buy({ value: buyAmount });
      
      expect(await dynamicPresale.contributionsWei(buyer1.address)).to.equal(maxTokenCost);
      expect(await dynamicPresale.pendingTokens(buyer1.address)).to.equal(remainingSupply);
      
      // Check that excess is in PullPayment
      const phase = await dynamicPresale.getPhase(0);
      expect(phase.sold).to.equal(remainingSupply);
    });

    it("Should enforce minimum buy amount", async function () {
      const tooSmall = MIN_BUY - ethers.parseEther("0.001");
      
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: tooSmall })
      ).to.be.revertedWith("Presale: below min buy");
    });

    it("Should enforce maximum per wallet", async function () {
      const tooMuch = MAX_PER_WALLET + ethers.parseEther("1");
      
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: tooMuch })
      ).to.be.revertedWith("Presale: above max per wallet");
    });

    it("Should handle multiple purchases per wallet", async function () {
      const buyAmount1 = ethers.parseEther("5");
      const buyAmount2 = ethers.parseEther("5");
      
      await dynamicPresale.connect(buyer1).buy({ value: buyAmount1 });
      await dynamicPresale.connect(buyer1).buy({ value: buyAmount2 });
      
      expect(await dynamicPresale.contributionsWei(buyer1.address)).to.equal(buyAmount1 + buyAmount2);
    });

    it("Should revert when no active phase", async function () {
      await time.increaseTo(phase0End + 100);
      
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: MIN_BUY })
      ).to.be.revertedWith("Presale: no active phase");
    });

    it("Should revert when sale ended", async function () {
      await dynamicPresale.endSale();
      
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: MIN_BUY })
      ).to.be.revertedWith("Presale: sale ended");
    });

    it("Should revert when paused", async function () {
      await dynamicPresale.pause();
      
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: MIN_BUY })
      ).to.be.revertedWithCustomError(dynamicPresale, "EnforcedPause");
    });

    it("Should track buyers correctly", async function () {
      await dynamicPresale.connect(buyer1).buy({ value: MIN_BUY });
      await dynamicPresale.connect(buyer2).buy({ value: MIN_BUY });
      
      expect(await dynamicPresale.totalBuyers()).to.equal(2);
    });

    it("Should reach soft cap and emit event", async function () {
      await expect(
        dynamicPresale.connect(buyer1).buy({ value: SOFT_CAP })
      ).to.emit(dynamicPresale, "SoftCapReached")
        .withArgs(SOFT_CAP);
      
      expect(await dynamicPresale.softCapReached()).to.be.true;
    });
  });

  describe("Calculate Tokens", function () {
    beforeEach(async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await time.increaseTo(phase0Start);
    });

    it("Should calculate tokens correctly", async function () {
      const ethAmount = ethers.parseEther("1");
      const [tokens, cost, excess] = await dynamicPresale.calculateTokens(ethAmount);
      
      const expectedTokens = (ethAmount * (10n ** BigInt(TOKEN_DECIMALS))) / PHASE_0_PRICE;
      const expectedCost = (expectedTokens * PHASE_0_PRICE) / (10n ** BigInt(TOKEN_DECIMALS));
      const expectedExcess = ethAmount - expectedCost;
      
      expect(tokens).to.equal(expectedTokens);
      expect(cost).to.equal(expectedCost);
      expect(excess).to.equal(expectedExcess);
    });

    it("Should handle partial fulfillment", async function () {
      // First, buy most of the phase
      const firstBuy = (PHASE_SUPPLY * PHASE_0_PRICE) / (10n ** BigInt(TOKEN_DECIMALS)) - ethers.parseEther("0.1");
      await dynamicPresale.connect(buyer1).buy({ value: firstBuy });
      
      // Now calculate for remaining
      const ethAmount = ethers.parseEther("1");
      const [tokens, cost, excess] = await dynamicPresale.calculateTokens(ethAmount);
      
      const remainingTokens = await dynamicPresale.remainingTokensInCurrentPhase();
      expect(tokens).to.equal(remainingTokens);
      expect(excess).to.be.gt(0);
    });
  });

  describe("Claim Tokens", function () {
    beforeEach(async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await time.increaseTo(phase0Start);
      
      // Buy tokens to reach soft cap
      await dynamicPresale.connect(buyer1).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
    });

    it("Should allow claiming tokens after sale ends and soft cap reached", async function () {
      const pendingTokens = await dynamicPresale.pendingTokens(buyer1.address);
      
      await dynamicPresale.connect(buyer1).claim();
      
      expect(await myToken.balanceOf(buyer1.address)).to.equal(pendingTokens);
      expect(await dynamicPresale.pendingTokens(buyer1.address)).to.equal(0);
    });

    it("Should emit Claimed event", async function () {
      const pendingTokens = await dynamicPresale.pendingTokens(buyer1.address);
      
      await expect(
        dynamicPresale.connect(buyer1).claim()
      ).to.emit(dynamicPresale, "Claimed")
        .withArgs(buyer1.address, pendingTokens);
    });

    it("Should revert if sale not ended", async function () {
      await dynamicPresale.addPhase(PHASE_1_PRICE, PHASE_SUPPLY, phase1Start, phase1End);
      // Restart sale
      await dynamicPresale.setSoftCap(SOFT_CAP);
      
      await expect(
        dynamicPresale.connect(buyer1).claim()
      ).to.be.revertedWith("Presale: sale not ended");
    });

    it("Should revert if soft cap not reached", async function () {
      // Deploy new presale with higher soft cap
      const highSoftCap = ethers.parseEther("100");
      const DynamicPresaleFactory = await ethers.getContractFactory("DynamicPresale");
      const newPresale = await DynamicPresaleFactory.deploy(
        await myToken.getAddress(),
        TOKEN_DECIMALS,
        highSoftCap,
        MIN_BUY,
        MAX_PER_WALLET
      );
      
      const MINTER_ROLE = await myToken.MINTER_ROLE();
      await myToken.grantRole(MINTER_ROLE, await newPresale.getAddress());
      
      await newPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await time.increaseTo(phase0Start);
      await newPresale.connect(buyer1).buy({ value: MIN_BUY });
      await newPresale.endSale();
      
      await expect(
        newPresale.connect(buyer1).claim()
      ).to.be.revertedWith("Presale: softCap not reached");
    });

    it("Should revert if nothing to claim", async function () {
      await expect(
        dynamicPresale.connect(buyer2).claim()
      ).to.be.revertedWith("Presale: nothing to claim");
    });
  });

  describe("Refunds", function () {
    let highSoftCapPresale: DynamicPresale;

    beforeEach(async function () {
      // Deploy presale with high soft cap to test refunds
      const highSoftCap = ethers.parseEther("100");
      const DynamicPresaleFactory = await ethers.getContractFactory("DynamicPresale");
      highSoftCapPresale = await DynamicPresaleFactory.deploy(
        await myToken.getAddress(),
        TOKEN_DECIMALS,
        highSoftCap,
        MIN_BUY,
        MAX_PER_WALLET
      );
      
      await highSoftCapPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await time.increaseTo(phase0Start);
      await highSoftCapPresale.connect(buyer1).buy({ value: MIN_BUY });
      await highSoftCapPresale.endSale();
    });

    it("Should allow refund when soft cap not reached", async function () {
      await highSoftCapPresale.connect(buyer1).requestRefund();
      
      expect(await highSoftCapPresale.contributionsWei(buyer1.address)).to.equal(0);
      expect(await highSoftCapPresale.pendingTokens(buyer1.address)).to.equal(0);
    });

    it("Should emit RefundRequested event", async function () {
      await expect(
        highSoftCapPresale.connect(buyer1).requestRefund()
      ).to.emit(highSoftCapPresale, "RefundRequested")
        .withArgs(buyer1.address, MIN_BUY);
    });

    it("Should revert refund if soft cap reached", async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await time.increaseTo(phase0Start);
      await dynamicPresale.connect(buyer1).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
      
      await expect(
        dynamicPresale.connect(buyer1).requestRefund()
      ).to.be.revertedWith("Presale: softCap reached");
    });

    it("Should revert if nothing to refund", async function () {
      await expect(
        highSoftCapPresale.connect(buyer2).requestRefund()
      ).to.be.revertedWith("Presale: nothing to refund");
    });
  });

  describe("Administrative Functions", function () {
    beforeEach(async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await time.increaseTo(phase0Start);
      await dynamicPresale.connect(buyer1).buy({ value: SOFT_CAP });
      await dynamicPresale.endSale();
    });

    it("Should allow owner to withdraw proceeds", async function () {
      const initialBalance = await ethers.provider.getBalance(beneficiary.address);
      
      await dynamicPresale.withdrawProceeds(beneficiary.address);
      
      const finalBalance = await ethers.provider.getBalance(beneficiary.address);
      expect(finalBalance - initialBalance).to.equal(SOFT_CAP);
    });

    it("Should emit Withdrawn event", async function () {
      await expect(
        dynamicPresale.withdrawProceeds(beneficiary.address)
      ).to.emit(dynamicPresale, "Withdrawn")
        .withArgs(beneficiary.address, SOFT_CAP);
    });

    it("Should allow owner to end sale", async function () {
      // Create new presale for this test
      const DynamicPresaleFactory = await ethers.getContractFactory("DynamicPresale");
      const newPresale = await DynamicPresaleFactory.deploy(
        await myToken.getAddress(),
        TOKEN_DECIMALS,
        SOFT_CAP,
        MIN_BUY,
        MAX_PER_WALLET
      );
      
      expect(await newPresale.saleEnded()).to.be.false;
      
      await expect(
        newPresale.endSale()
      ).to.emit(newPresale, "SaleEnded")
        .withArgs(false); // softCapReached = false
      
      expect(await newPresale.saleEnded()).to.be.true;
    });

    it("Should allow owner to set parameters", async function () {
      const newSoftCap = ethers.parseEther("20");
      const newMinBuy = ethers.parseEther("0.02");
      const newMaxPerWallet = ethers.parseEther("40");
      
      // Create new presale to test setters
      const DynamicPresaleFactory = await ethers.getContractFactory("DynamicPresale");
      const newPresale = await DynamicPresaleFactory.deploy(
        await myToken.getAddress(),
        TOKEN_DECIMALS,
        SOFT_CAP,
        MIN_BUY,
        MAX_PER_WALLET
      );
      
      await newPresale.setSoftCap(newSoftCap);
      await newPresale.setMinBuy(newMinBuy);
      await newPresale.setMaxPerWallet(newMaxPerWallet);
      
      expect(await newPresale.softCap()).to.equal(newSoftCap);
      expect(await newPresale.minBuy()).to.equal(newMinBuy);
      expect(await newPresale.maxPerWallet()).to.equal(newMaxPerWallet);
    });

    it("Should only allow owner to call admin functions", async function () {
      await expect(
        dynamicPresale.connect(buyer1).withdrawProceeds(buyer1.address)
      ).to.be.revertedWithCustomError(dynamicPresale, "OwnableUnauthorizedAccount");
      
      await expect(
        dynamicPresale.connect(buyer1).endSale()
      ).to.be.revertedWithCustomError(dynamicPresale, "OwnableUnauthorizedAccount");
      
      await expect(
        dynamicPresale.connect(buyer1).setSoftCap(ethers.parseEther("20"))
      ).to.be.revertedWithCustomError(dynamicPresale, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await dynamicPresale.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
      await dynamicPresale.addPhase(PHASE_1_PRICE, PHASE_SUPPLY, phase1Start, phase1End);
    });

    it("Should return current phase correctly", async function () {
      await time.increaseTo(phase0Start);
      expect(await dynamicPresale.getCurrentPhase()).to.equal(0);
      
      await time.increaseTo(phase1Start);
      expect(await dynamicPresale.getCurrentPhase()).to.equal(1);
    });

    it("Should return hasActivePhase correctly", async function () {
      expect(await dynamicPresale.hasActivePhase()).to.be.false;
      
      await time.increaseTo(phase0Start);
      expect(await dynamicPresale.hasActivePhase()).to.be.true;
      
      await time.increaseTo(phase2End + 100);
      expect(await dynamicPresale.hasActivePhase()).to.be.false;
    });

    it("Should return remaining tokens correctly", async function () {
      await time.increaseTo(phase0Start);
      expect(await dynamicPresale.remainingTokensInCurrentPhase()).to.equal(PHASE_SUPPLY);
      
      const buyAmount = ethers.parseEther("1");
      await dynamicPresale.connect(buyer1).buy({ value: buyAmount });
      
      const expectedTokensBought = (buyAmount * (10n ** BigInt(TOKEN_DECIMALS))) / PHASE_0_PRICE;
      expect(await dynamicPresale.remainingTokensInCurrentPhase()).to.equal(PHASE_SUPPLY - expectedTokensBought);
    });

    it("Should return total phases correctly", async function () {
      expect(await dynamicPresale.totalPhases()).to.equal(2);
    });
  });
});