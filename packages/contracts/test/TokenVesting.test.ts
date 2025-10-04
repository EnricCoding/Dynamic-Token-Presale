import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenVesting, MyToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Helper function to compare values with precision tolerance (0.01%)
function expectApproxEqual(actual: bigint, expected: bigint, tolerancePercent: number = 0.01) {
  const tolerance = (expected * BigInt(Math.floor(tolerancePercent * 100))) / 10000n;
  const diff = actual > expected ? actual - expected : expected - actual;
  expect(diff).to.be.lte(tolerance, `Expected ${actual} to be approximately ${expected} (within ${tolerancePercent}%)`);
}

describe("TokenVesting", function () {
  let tokenVesting: TokenVesting;
  let myToken: MyToken;
  let owner: SignerWithAddress;
  let beneficiary1: SignerWithAddress;
  let beneficiary2: SignerWithAddress;
  let beneficiary3: SignerWithAddress;

  const TOKEN_NAME = "Dynamic Presale Token";
  const TOKEN_SYMBOL = "DPT";
  const TOKEN_CAP = ethers.parseEther("100000000"); // 100M tokens
  
  const VESTING_AMOUNT = ethers.parseEther("10000"); // 10k tokens
  const VESTING_DURATION = 365 * 24 * 60 * 60; // 1 year in seconds
  const CLIFF_PERIOD = 90 * 24 * 60 * 60; // 90 days in seconds

  // Helper function for approximate equality (within 0.01% tolerance)
  function expectApproxEqual(actual: bigint, expected: bigint, tolerance: bigint = expected / 10000n) {
    const diff = actual > expected ? actual - expected : expected - actual;
    expect(diff).to.be.lte(tolerance, `Expected ${actual} to be approximately ${expected}, diff: ${diff}, tolerance: ${tolerance}`);
  }

  let vestingStart: number;

  beforeEach(async function () {
    [owner, beneficiary1, beneficiary2, beneficiary3] = await ethers.getSigners();

    // Deploy MyToken
    const MyTokenFactory = await ethers.getContractFactory("MyToken");
    myToken = await MyTokenFactory.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_CAP);
    await myToken.waitForDeployment();

    // Deploy TokenVesting
    const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
    tokenVesting = await TokenVestingFactory.deploy(await myToken.getAddress());
    await tokenVesting.waitForDeployment();

    // Mint tokens to vesting contract
    const totalTokensNeeded = VESTING_AMOUNT * 5n; // Enough for multiple vestings
    await myToken.mint(await tokenVesting.getAddress(), totalTokensNeeded);

    vestingStart = await time.latest() + 100;
  });

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      expect(await tokenVesting.token()).to.equal(await myToken.getAddress());
    });

    it("Should set the right owner", async function () {
      expect(await tokenVesting.owner()).to.equal(owner.address);
    });

    it("Should start with zero vesting schedules", async function () {
      expect(await tokenVesting.totalVestingSchedules()).to.equal(0);
    });

    it("Should revert with zero token address", async function () {
      const TokenVestingFactory = await ethers.getContractFactory("TokenVesting");
      await expect(
        TokenVestingFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Vesting: token address zero");
    });
  });

  describe("Create Vesting", function () {
    it("Should create vesting schedule correctly", async function () {
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );

      const schedule = await tokenVesting.getSchedule(beneficiary1.address, 0);
      expect(schedule.totalAmount).to.equal(VESTING_AMOUNT);
      expect(schedule.released).to.equal(0);
      expect(schedule.start).to.equal(vestingStart);
      expect(schedule.duration).to.equal(VESTING_DURATION);
      expect(schedule.cliff).to.equal(CLIFF_PERIOD);
      expect(schedule.revocable).to.be.false;
      expect(schedule.revoked).to.be.false;

      expect(await tokenVesting.totalVestedAmount(beneficiary1.address)).to.equal(VESTING_AMOUNT);
      expect(await tokenVesting.totalCommitted()).to.equal(VESTING_AMOUNT);
      expect(await tokenVesting.totalVestingSchedules()).to.equal(1);
      expect(await tokenVesting.getScheduleCount(beneficiary1.address)).to.equal(1);
    });

    it("Should emit VestingCreated event", async function () {
      await expect(
        tokenVesting.createVesting(
          beneficiary1.address,
          VESTING_AMOUNT,
          vestingStart,
          VESTING_DURATION,
          CLIFF_PERIOD,
          true
        )
      ).to.emit(tokenVesting, "VestingCreated")
        .withArgs(beneficiary1.address, 0, VESTING_AMOUNT, vestingStart, VESTING_DURATION, CLIFF_PERIOD, true);
    });

    it("Should allow multiple vesting schedules per beneficiary", async function () {
      const secondAmount = ethers.parseEther("5000");
      const secondStart = vestingStart + 1000;

      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );

      await tokenVesting.createVesting(
        beneficiary1.address,
        secondAmount,
        secondStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        true
      );

      expect(await tokenVesting.getScheduleCount(beneficiary1.address)).to.equal(2);
      expect(await tokenVesting.totalVestedAmount(beneficiary1.address)).to.equal(VESTING_AMOUNT + secondAmount);
      expect(await tokenVesting.totalCommitted()).to.equal(VESTING_AMOUNT + secondAmount);
      expect(await tokenVesting.totalVestingSchedules()).to.equal(2);
    });

    it("Should revert with invalid parameters", async function () {
      // Zero beneficiary
      await expect(
        tokenVesting.createVesting(ethers.ZeroAddress, VESTING_AMOUNT, vestingStart, VESTING_DURATION, CLIFF_PERIOD, false)
      ).to.be.revertedWith("Vesting: beneficiary zero");

      // Zero amount
      await expect(
        tokenVesting.createVesting(beneficiary1.address, 0, vestingStart, VESTING_DURATION, CLIFF_PERIOD, false)
      ).to.be.revertedWith("Vesting: zero amount");

      // Zero duration
      await expect(
        tokenVesting.createVesting(beneficiary1.address, VESTING_AMOUNT, vestingStart, 0, CLIFF_PERIOD, false)
      ).to.be.revertedWith("Vesting: zero duration");

      // Cliff greater than duration
      await expect(
        tokenVesting.createVesting(beneficiary1.address, VESTING_AMOUNT, vestingStart, CLIFF_PERIOD, VESTING_DURATION, false)
      ).to.be.revertedWith("Vesting: cliff greater than duration");

      // Start time in past
      const pastTime = (await time.latest()) - 100;
      await expect(
        tokenVesting.createVesting(beneficiary1.address, VESTING_AMOUNT, pastTime, VESTING_DURATION, CLIFF_PERIOD, false)
      ).to.be.revertedWith("Vesting: start time in past");
    });

    it("Should revert with insufficient token balance", async function () {
      const excessiveAmount = await myToken.balanceOf(await tokenVesting.getAddress()) + ethers.parseEther("1");
      
      await expect(
        tokenVesting.createVesting(beneficiary1.address, excessiveAmount, vestingStart, VESTING_DURATION, CLIFF_PERIOD, false)
      ).to.be.revertedWith("Vesting: insufficient token balance for new vesting");
    });

    it("Should revert when paused", async function () {
      await tokenVesting.pause();
      
      await expect(
        tokenVesting.createVesting(beneficiary1.address, VESTING_AMOUNT, vestingStart, VESTING_DURATION, CLIFF_PERIOD, false)
      ).to.be.revertedWithCustomError(tokenVesting, "EnforcedPause");
    });

    it("Should only allow owner to create vesting", async function () {
      await expect(
        tokenVesting.connect(beneficiary1).createVesting(
          beneficiary2.address, VESTING_AMOUNT, vestingStart, VESTING_DURATION, CLIFF_PERIOD, false
        )
      ).to.be.revertedWithCustomError(tokenVesting, "OwnableUnauthorizedAccount");
    });
  });

  describe("Token Release", function () {
    beforeEach(async function () {
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );
    });

    it("Should not release tokens before cliff", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD - 1000);
      
      expect(await tokenVesting.getVestedAmount(beneficiary1.address, 0)).to.equal(0);
      expect(await tokenVesting.getReleasableAmount(beneficiary1.address, 0)).to.equal(0);
      
      await expect(
        tokenVesting.connect(beneficiary1).releaseSchedule(0)
      ).to.be.revertedWith("Vesting: nothing to release");
    });

    it("Should release correct amount after cliff", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const expectedVested = (VESTING_AMOUNT * BigInt(CLIFF_PERIOD + 1000)) / BigInt(VESTING_DURATION);
      expect(await tokenVesting.getVestedAmount(beneficiary1.address, 0)).to.equal(expectedVested);
      expect(await tokenVesting.getReleasableAmount(beneficiary1.address, 0)).to.equal(expectedVested);
    });

    it("Should release tokens correctly", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const initialBalance = await myToken.balanceOf(beneficiary1.address);
      const releasableAmount = await tokenVesting.getReleasableAmount(beneficiary1.address, 0);
      
      await tokenVesting.connect(beneficiary1).releaseSchedule(0);
      
      const finalBalance = await myToken.balanceOf(beneficiary1.address);
      expectApproxEqual(finalBalance - initialBalance, releasableAmount);
      
      const schedule = await tokenVesting.getSchedule(beneficiary1.address, 0);
      expectApproxEqual(schedule.released, releasableAmount);
    });

    it("Should emit TokensReleased event", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const releasableAmount = await tokenVesting.getReleasableAmount(beneficiary1.address, 0);
      
      // Use transaction receipt to check event emission
      const tx = await tokenVesting.connect(beneficiary1).releaseSchedule(0);
      const receipt = await tx.wait();
      expect(receipt?.logs).to.have.length.greaterThan(0);
      
      // Verify the actual release happened with approximate amount
      const schedule = await tokenVesting.getSchedule(beneficiary1.address, 0);
      expectApproxEqual(schedule.released, releasableAmount);
    });

    it("Should release all tokens at end of vesting", async function () {
      await time.increaseTo(vestingStart + VESTING_DURATION);
      
      expect(await tokenVesting.getVestedAmount(beneficiary1.address, 0)).to.equal(VESTING_AMOUNT);
      
      await tokenVesting.connect(beneficiary1).releaseSchedule(0);
      
      expect(await myToken.balanceOf(beneficiary1.address)).to.equal(VESTING_AMOUNT);
      
      const schedule = await tokenVesting.getSchedule(beneficiary1.address, 0);
      expect(schedule.released).to.equal(VESTING_AMOUNT);
    });

    it("Should handle partial releases correctly", async function () {
      // Release after cliff
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      const firstRelease = await tokenVesting.getReleasableAmount(beneficiary1.address, 0);
      await tokenVesting.connect(beneficiary1).releaseSchedule(0);
      
      // Release again later
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 10000);
      const secondRelease = await tokenVesting.getReleasableAmount(beneficiary1.address, 0);
      await tokenVesting.connect(beneficiary1).releaseSchedule(0);
      
      expectApproxEqual(await myToken.balanceOf(beneficiary1.address), firstRelease + secondRelease);
    });

    it("Should release all schedules at once", async function () {
      // Create second vesting schedule
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );

      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const totalReleasable = await tokenVesting.getTotalReleasableAmount(beneficiary1.address);
      
      await tokenVesting.connect(beneficiary1).release();
      
      expectApproxEqual(await myToken.balanceOf(beneficiary1.address), totalReleasable);
    });

    it("Should revert when paused", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      await tokenVesting.pause();
      
      await expect(
        tokenVesting.connect(beneficiary1).releaseSchedule(0)
      ).to.be.revertedWithCustomError(tokenVesting, "EnforcedPause");
    });

    it("Should revert with invalid schedule ID", async function () {
      await expect(
        tokenVesting.connect(beneficiary1).releaseSchedule(999)
      ).to.be.revertedWith("Vesting: invalid schedule ID");
    });
  });

  describe("Revoke Vesting", function () {
    beforeEach(async function () {
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        true // revocable
      );
    });

    it("Should revoke vesting schedule", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const vestedAmount = await tokenVesting.getVestedAmount(beneficiary1.address, 0);
      const unvestedAmount = VESTING_AMOUNT - vestedAmount;
      const ownerBalanceBefore = await myToken.balanceOf(owner.address);
      
      await tokenVesting.revokeVesting(beneficiary1.address, 0);
      
      const schedule = await tokenVesting.getSchedule(beneficiary1.address, 0);
      expect(schedule.revoked).to.be.true;
      
      const ownerBalanceAfter = await myToken.balanceOf(owner.address);
      expectApproxEqual(ownerBalanceAfter - ownerBalanceBefore, unvestedAmount);
      
      expectApproxEqual(await tokenVesting.totalVestedAmount(beneficiary1.address), vestedAmount);
      expectApproxEqual(await tokenVesting.totalCommitted(), vestedAmount);
    });

    it("Should emit VestingRevoked event", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const vestedAmount = await tokenVesting.getVestedAmount(beneficiary1.address, 0);
      const unvestedAmount = VESTING_AMOUNT - vestedAmount;
      
      // Use transaction receipt to check event emission
      const tx = await tokenVesting.revokeVesting(beneficiary1.address, 0);
      const receipt = await tx.wait();
      expect(receipt?.logs).to.have.length.greaterThan(0);
    });

    it("Should not allow revoking non-revocable vesting", async function () {
      // Create non-revocable vesting
      await tokenVesting.createVesting(
        beneficiary2.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false // not revocable
      );
      
      await expect(
        tokenVesting.revokeVesting(beneficiary2.address, 0)
      ).to.be.revertedWith("Vesting: not revocable");
    });

    it("Should not allow revoking already revoked vesting", async function () {
      await tokenVesting.revokeVesting(beneficiary1.address, 0);
      
      await expect(
        tokenVesting.revokeVesting(beneficiary1.address, 0)
      ).to.be.revertedWith("Vesting: already revoked");
    });

    it("Should not allow releasing from revoked schedule", async function () {
      await tokenVesting.revokeVesting(beneficiary1.address, 0);
      
      await expect(
        tokenVesting.connect(beneficiary1).releaseSchedule(0)
      ).to.be.revertedWith("Vesting: schedule revoked");
    });

    it("Should only allow owner to revoke", async function () {
      await expect(
        tokenVesting.connect(beneficiary1).revokeVesting(beneficiary1.address, 0)
      ).to.be.revertedWithCustomError(tokenVesting, "OwnableUnauthorizedAccount");
    });
  });

  describe("Administrative Functions", function () {
    beforeEach(async function () {
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );
    });

    it("Should allow owner to emergency withdraw", async function () {
      const contractBalance = await myToken.balanceOf(await tokenVesting.getAddress());
      const withdrawAmount = ethers.parseEther("1000");
      const ownerBalanceBefore = await myToken.balanceOf(owner.address);
      
      await tokenVesting.emergencyWithdraw(withdrawAmount);
      
      const ownerBalanceAfter = await myToken.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(withdrawAmount);
    });

    it("Should not allow emergency withdraw of more than balance", async function () {
      const contractBalance = await myToken.balanceOf(await tokenVesting.getAddress());
      const excessiveAmount = contractBalance + ethers.parseEther("1");
      
      await expect(
        tokenVesting.emergencyWithdraw(excessiveAmount)
      ).to.be.revertedWith("Vesting: insufficient balance");
    });

    it("Should allow owner to pause and unpause", async function () {
      expect(await tokenVesting.paused()).to.be.false;
      
      await tokenVesting.pause();
      expect(await tokenVesting.paused()).to.be.true;
      
      await tokenVesting.unpause();
      expect(await tokenVesting.paused()).to.be.false;
    });

    it("Should only allow owner to call admin functions", async function () {
      await expect(
        tokenVesting.connect(beneficiary1).emergencyWithdraw(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(tokenVesting, "OwnableUnauthorizedAccount");
      
      await expect(
        tokenVesting.connect(beneficiary1).pause()
      ).to.be.revertedWithCustomError(tokenVesting, "OwnableUnauthorizedAccount");
      
      await expect(
        tokenVesting.connect(beneficiary1).unpause()
      ).to.be.revertedWithCustomError(tokenVesting, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );
      
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT / 2n,
        vestingStart + 1000,
        VESTING_DURATION,
        CLIFF_PERIOD,
        true
      );
    });

    it("Should return schedule count correctly", async function () {
      expect(await tokenVesting.getScheduleCount(beneficiary1.address)).to.equal(2);
      expect(await tokenVesting.getScheduleCount(beneficiary2.address)).to.equal(0);
    });

    it("Should return vested amount correctly", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const vestedAmount = await tokenVesting.getVestedAmount(beneficiary1.address, 0);
      const expectedVested = (VESTING_AMOUNT * BigInt(CLIFF_PERIOD + 1000)) / BigInt(VESTING_DURATION);
      
      expect(vestedAmount).to.equal(expectedVested);
    });

    it("Should return releasable amount correctly", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 1000);
      
      const releasableAmount = await tokenVesting.getReleasableAmount(beneficiary1.address, 0);
      const vestedAmount = await tokenVesting.getVestedAmount(beneficiary1.address, 0);
      
      expect(releasableAmount).to.equal(vestedAmount);
      
      // After partial release
      await tokenVesting.connect(beneficiary1).releaseSchedule(0);
      expect(await tokenVesting.getReleasableAmount(beneficiary1.address, 0)).to.equal(0);
    });

    it("Should return total releasable amount correctly", async function () {
      await time.increaseTo(vestingStart + CLIFF_PERIOD + 2000);
      
      const totalReleasable = await tokenVesting.getTotalReleasableAmount(beneficiary1.address);
      const releasable1 = await tokenVesting.getReleasableAmount(beneficiary1.address, 0);
      const releasable2 = await tokenVesting.getReleasableAmount(beneficiary1.address, 1);
      
      expect(totalReleasable).to.equal(releasable1 + releasable2);
    });

    it("Should return schedule details correctly", async function () {
      const schedule = await tokenVesting.getSchedule(beneficiary1.address, 0);
      
      expect(schedule.totalAmount).to.equal(VESTING_AMOUNT);
      expect(schedule.released).to.equal(0);
      expect(schedule.start).to.equal(vestingStart);
      expect(schedule.duration).to.equal(VESTING_DURATION);
      expect(schedule.cliff).to.equal(CLIFF_PERIOD);
      expect(schedule.revocable).to.be.false;
      expect(schedule.revoked).to.be.false;
    });

    it("Should handle revoked schedules in view functions", async function () {
      await tokenVesting.revokeVesting(beneficiary1.address, 1);
      
      expect(await tokenVesting.getReleasableAmount(beneficiary1.address, 1)).to.equal(0);
      
      const totalReleasable = await tokenVesting.getTotalReleasableAmount(beneficiary1.address);
      const releasable1 = await tokenVesting.getReleasableAmount(beneficiary1.address, 0);
      
      expect(totalReleasable).to.equal(releasable1); // Only from non-revoked schedule
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero cliff period", async function () {
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        0, // No cliff
        false
      );
      
      await time.increaseTo(vestingStart + 1000);
      
      const expectedVested = (VESTING_AMOUNT * 1000n) / BigInt(VESTING_DURATION);
      expect(await tokenVesting.getVestedAmount(beneficiary1.address, 0)).to.equal(expectedVested);
    });

    it("Should handle very short vesting duration", async function () {
      const shortDuration = 3600; // 1 hour
      
      await tokenVesting.createVesting(
        beneficiary1.address,
        VESTING_AMOUNT,
        vestingStart,
        shortDuration,
        0,
        false
      );
      
      await time.increaseTo(vestingStart + shortDuration);
      
      expect(await tokenVesting.getVestedAmount(beneficiary1.address, 0)).to.equal(VESTING_AMOUNT);
    });

    it("Should handle multiple beneficiaries correctly", async function () {
      await tokenVesting.createVesting(
        beneficiary2.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );
      
      await tokenVesting.createVesting(
        beneficiary3.address,
        VESTING_AMOUNT,
        vestingStart,
        VESTING_DURATION,
        CLIFF_PERIOD,
        false
      );
      
      expect(await tokenVesting.totalVestingSchedules()).to.equal(2);
      expect(await tokenVesting.totalCommitted()).to.equal(VESTING_AMOUNT * 2n);
    });
  });
});