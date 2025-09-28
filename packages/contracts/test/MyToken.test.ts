import { expect } from "chai";
import { ethers } from "hardhat";
import { MyToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MyToken", function () {
  let myToken: MyToken;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let pauser: SignerWithAddress;
  let burner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const TOKEN_NAME = "Dynamic Presale Token";
  const TOKEN_SYMBOL = "DPT";
  const TOKEN_CAP = ethers.parseEther("100000000"); // 100M tokens
  const MINT_AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, minter, pauser, burner, user1, user2] = await ethers.getSigners();

    const MyTokenFactory = await ethers.getContractFactory("MyToken");
    myToken = await MyTokenFactory.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_CAP);
    await myToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await myToken.name()).to.equal(TOKEN_NAME);
      expect(await myToken.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should set the right cap", async function () {
      expect(await myToken.cap()).to.equal(TOKEN_CAP);
    });

    it("Should assign all roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await myToken.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await myToken.MINTER_ROLE();
      const PAUSER_ROLE = await myToken.PAUSER_ROLE();
      const BURNER_ROLE = await myToken.BURNER_ROLE();

      expect(await myToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await myToken.hasRole(MINTER_ROLE, owner.address)).to.be.true;
      expect(await myToken.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      expect(await myToken.hasRole(BURNER_ROLE, owner.address)).to.be.true;
    });

    it("Should start unpaused", async function () {
      expect(await myToken.paused()).to.be.false;
    });

    it("Should have zero initial supply", async function () {
      expect(await myToken.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      await myToken.mint(user1.address, MINT_AMOUNT);
      expect(await myToken.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
      expect(await myToken.totalSupply()).to.equal(MINT_AMOUNT);
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(
        myToken.connect(user1).mint(user2.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(myToken, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow minting to zero address", async function () {
      await expect(
        myToken.mint(ethers.ZeroAddress, MINT_AMOUNT)
      ).to.be.revertedWith("MyToken: mint to zero address");
    });

    it("Should not allow minting zero amount", async function () {
      await expect(
        myToken.mint(user1.address, 0)
      ).to.be.revertedWith("MyToken: mint amount must be greater than 0");
    });

    it("Should not allow minting when paused", async function () {
      await myToken.pause();
      await expect(
        myToken.mint(user1.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(myToken, "EnforcedPause");
    });

    it("Should not allow minting beyond cap", async function () {
      const OVER_CAP = TOKEN_CAP + ethers.parseEther("1");
      await expect(
        myToken.mint(user1.address, OVER_CAP)
      ).to.be.revertedWithCustomError(myToken, "ERC20ExceededCap");
    });

    it("Should allow minting up to cap", async function () {
      await myToken.mint(user1.address, TOKEN_CAP);
      expect(await myToken.totalSupply()).to.equal(TOKEN_CAP);
    });
  });

  describe("Roles Management", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await myToken.MINTER_ROLE();
      const PAUSER_ROLE = await myToken.PAUSER_ROLE();
      const BURNER_ROLE = await myToken.BURNER_ROLE();

      await myToken.grantRole(MINTER_ROLE, minter.address);
      await myToken.grantRole(PAUSER_ROLE, pauser.address);
      await myToken.grantRole(BURNER_ROLE, burner.address);
    });

    it("Should allow assigned minter to mint", async function () {
      await myToken.connect(minter).mint(user1.address, MINT_AMOUNT);
      expect(await myToken.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
    });

    it("Should allow assigned pauser to pause", async function () {
      await myToken.connect(pauser).pause();
      expect(await myToken.paused()).to.be.true;
    });

    it("Should allow assigned burner to burn from others", async function () {
      await myToken.mint(user1.address, MINT_AMOUNT);
      await myToken.connect(user1).approve(burner.address, MINT_AMOUNT);
      await myToken.connect(burner).burnFrom(user1.address, MINT_AMOUNT);
      expect(await myToken.balanceOf(user1.address)).to.equal(0);
    });

    it("Should allow admin to revoke roles", async function () {
      const MINTER_ROLE = await myToken.MINTER_ROLE();
      await myToken.revokeRole(MINTER_ROLE, minter.address);
      
      await expect(
        myToken.connect(minter).mint(user1.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(myToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Pausing", function () {
    it("Should allow pauser to pause", async function () {
      await myToken.pause();
      expect(await myToken.paused()).to.be.true;
    });

    it("Should allow pauser to unpause", async function () {
      await myToken.pause();
      await myToken.unpause();
      expect(await myToken.paused()).to.be.false;
    });

    it("Should not allow non-pauser to pause", async function () {
      await expect(
        myToken.connect(user1).pause()
      ).to.be.revertedWithCustomError(myToken, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent transfers when paused", async function () {
      await myToken.mint(user1.address, MINT_AMOUNT);
      await myToken.pause();
      
      await expect(
        myToken.connect(user1).transfer(user2.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(myToken, "EnforcedPause");
    });

    it("Should allow transfers when unpaused", async function () {
      await myToken.mint(user1.address, MINT_AMOUNT);
      await myToken.pause();
      await myToken.unpause();
      
      await myToken.connect(user1).transfer(user2.address, MINT_AMOUNT);
      expect(await myToken.balanceOf(user2.address)).to.equal(MINT_AMOUNT);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await myToken.mint(user1.address, MINT_AMOUNT);
    });

    it("Should allow users to burn their own tokens", async function () {
      await myToken.connect(user1).burn(MINT_AMOUNT);
      expect(await myToken.balanceOf(user1.address)).to.equal(0);
      expect(await myToken.totalSupply()).to.equal(0);
    });

    it("Should allow approved burner to burn from others", async function () {
      await myToken.connect(user1).approve(owner.address, MINT_AMOUNT);
      await myToken.burnFrom(user1.address, MINT_AMOUNT);
      expect(await myToken.balanceOf(user1.address)).to.equal(0);
    });

    it("Should not allow non-burner role to burn from others without approval", async function () {
      await expect(
        myToken.connect(user2).burnFrom(user1.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(myToken, "AccessControlUnauthorizedAccount");
    });

    it("Should allow admin to emergency burn", async function () {
      await myToken.emergencyBurn(user1.address, MINT_AMOUNT);
      expect(await myToken.balanceOf(user1.address)).to.equal(0);
    });

    it("Should not allow non-admin to emergency burn", async function () {
      await expect(
        myToken.connect(user1).emergencyBurn(user2.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(myToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Supports Interface", function () {
    it("Should support AccessControl interface", async function () {
      const INTERFACE_ID_ACCESS_CONTROL = "0x7965db0b";
      expect(await myToken.supportsInterface(INTERFACE_ID_ACCESS_CONTROL)).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple mints correctly", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200"); 
      
      await myToken.mint(user1.address, amount1);
      await myToken.mint(user1.address, amount2);
      
      expect(await myToken.balanceOf(user1.address)).to.equal(amount1 + amount2);
    });

    it("Should handle role transfers correctly", async function () {
      const MINTER_ROLE = await myToken.MINTER_ROLE();
      
      await myToken.grantRole(MINTER_ROLE, user1.address);
      await myToken.revokeRole(MINTER_ROLE, owner.address);
      
      await expect(
        myToken.mint(user2.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(myToken, "AccessControlUnauthorizedAccount");
      
      await myToken.connect(user1).mint(user2.address, MINT_AMOUNT);
      expect(await myToken.balanceOf(user2.address)).to.equal(MINT_AMOUNT);
    });
  });
});