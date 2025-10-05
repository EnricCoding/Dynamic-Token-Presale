import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log("Deploying Dynamic Presale System Contracts...");
  log("----------------------------------------------------");

  // Contract parameters
  const TOKEN_NAME = "Dynamic Presale Token";
  const TOKEN_SYMBOL = "DPT";
  const TOKEN_CAP = ethers.parseEther("100000000"); // 100M tokens
  const TOKEN_DECIMALS = 18;

  // Presale parameters
  const SOFT_CAP = ethers.parseEther("10"); // 10 ETH
  const MIN_BUY = ethers.parseEther("0.01"); // 0.01 ETH
  const MAX_PER_WALLET = ethers.parseEther("20"); // 20 ETH

  // Phase parameters  
  const PHASE_0_PRICE = ethers.parseUnits("0.0005", "ether"); // 0.0005 ETH per token
  const PHASE_1_PRICE = ethers.parseUnits("0.001", "ether"); // 0.001 ETH per token
  const PHASE_2_PRICE = ethers.parseUnits("0.002", "ether"); // 0.002 ETH per token
  const PHASE_SUPPLY = ethers.parseEther("100000"); // 100k tokens per phase

  // Deploy MyToken
  log("Deploying MyToken...");
  const myToken = await deploy("MyToken", {
    from: deployer,
    args: [TOKEN_NAME, TOKEN_SYMBOL, TOKEN_CAP],
    log: true,
    deterministicDeployment: false,
  });

  log(`MyToken deployed at: ${myToken.address}`);

  // Deploy DynamicPresale
  log("Deploying DynamicPresale...");
  const dynamicPresale = await deploy("DynamicPresale", {
    from: deployer,
    args: [myToken.address, TOKEN_DECIMALS, SOFT_CAP, MIN_BUY, MAX_PER_WALLET],
    log: true,
    deterministicDeployment: false,
  });

  log(`DynamicPresale deployed at: ${dynamicPresale.address}`);

  // Deploy TokenVesting
  log("Deploying TokenVesting...");
  const tokenVesting = await deploy("TokenVesting", {
    from: deployer,
    args: [myToken.address],
    log: true,
    deterministicDeployment: false,
  });

  log(`TokenVesting deployed at: ${tokenVesting.address}`);

  // Setup contracts
  log("Setting up contracts...");
  
  const tokenContract = await ethers.getContractAt("MyToken", myToken.address);
  const presaleContract = await ethers.getContractAt("DynamicPresale", dynamicPresale.address);

  // Grant MINTER_ROLE to presale contract
  const MINTER_ROLE = await tokenContract.MINTER_ROLE();
  const grantRoleTx = await tokenContract.grantRole(MINTER_ROLE, dynamicPresale.address);
  await grantRoleTx.wait();
  log("✅ MINTER_ROLE granted to DynamicPresale");

  // Add presale phases (only if not already added)
  const totalPhases = await presaleContract.totalPhases();
  if (totalPhases === 0n) {
    // Calculate phase times (1 hour each, starting in 1 hour)
    const currentTime = Math.floor(Date.now() / 1000);
    const phase0Start = currentTime + 3600; // 1 hour from now
    const phase0End = phase0Start + 3600; // 1 hour duration
    const phase1Start = phase0End + 300; // 5 minutes gap
    const phase1End = phase1Start + 3600;
    const phase2Start = phase1End + 300;
    const phase2End = phase2Start + 3600;

    const addPhase0Tx = await presaleContract.addPhase(PHASE_0_PRICE, PHASE_SUPPLY, phase0Start, phase0End);
    await addPhase0Tx.wait();
    log("✅ Phase 0 added");

    const addPhase1Tx = await presaleContract.addPhase(PHASE_1_PRICE, PHASE_SUPPLY, phase1Start, phase1End);
    await addPhase1Tx.wait();
    log("✅ Phase 1 added");

    const addPhase2Tx = await presaleContract.addPhase(PHASE_2_PRICE, PHASE_SUPPLY, phase2Start, phase2End);
    await addPhase2Tx.wait();
    log("✅ Phase 2 added");
  }

  // Mint tokens for vesting contract (team allocation)
  const vestingTokens = ethers.parseEther("15000000"); // 15M tokens for team/advisors
  const mintTx = await tokenContract.mint(tokenVesting.address, vestingTokens);
  await mintTx.wait();
  log(`✅ ${ethers.formatEther(vestingTokens)} tokens minted to TokenVesting`);

  log("----------------------------------------------------");
  log("🎉 Deployment completed successfully!");
  log("----------------------------------------------------");
  log("Contract Addresses:");
  log(`MyToken: ${myToken.address}`);
  log(`DynamicPresale: ${dynamicPresale.address}`);
  log(`TokenVesting: ${tokenVesting.address}`);
  log("----------------------------------------------------");
  log("Next Steps:");
  log("1. Verify contracts on explorer");
  log("2. Set up presale phases if needed");
  log("3. Create team/advisor vesting schedules");
  log("4. Test buying functionality");
  log("----------------------------------------------------");

  // Save deployment info to file
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    contracts: {
      MyToken: {
        address: myToken.address,
        args: [TOKEN_NAME, TOKEN_SYMBOL, TOKEN_CAP.toString()],
      },
      DynamicPresale: {
        address: dynamicPresale.address,
        args: [myToken.address, TOKEN_DECIMALS, SOFT_CAP.toString(), MIN_BUY.toString(), MAX_PER_WALLET.toString()],
      },
      TokenVesting: {
        address: tokenVesting.address,
        args: [myToken.address],
      },
    },
    parameters: {
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_CAP: TOKEN_CAP.toString(),
      SOFT_CAP: SOFT_CAP.toString(),
      MIN_BUY: MIN_BUY.toString(),
      MAX_PER_WALLET: MAX_PER_WALLET.toString(),
      PHASE_0_PRICE: PHASE_0_PRICE.toString(),
      PHASE_1_PRICE: PHASE_1_PRICE.toString(),
      PHASE_2_PRICE: PHASE_2_PRICE.toString(),
      PHASE_SUPPLY: PHASE_SUPPLY.toString(),
    },
  };

  const deploymentPath = `deployments/${hre.network.name}_deployment.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  log(`📄 Deployment info saved to: ${deploymentPath}`);
};

func.tags = ["all", "DynamicPresaleSystem"];
func.dependencies = [];

export default func;