import { ethers } from "hardhat";

async function main() {
  const DYNAMICPRESALE_ADDRESS = process.env.DYNAMICPRESALE_ADDRESS || "";
  
  if (!DYNAMICPRESALE_ADDRESS) {
    console.error("❌ Please set DYNAMICPRESALE_ADDRESS environment variable");
    process.exit(1);
  }

  const [buyer] = await ethers.getSigners();
  console.log("🛒 Buying tokens with account:", buyer.address);

  const dynamicPresale = await ethers.getContractAt("DynamicPresale", DYNAMICPRESALE_ADDRESS);

  // Get buy amount from command line or default to minimum
  const buyAmount = process.argv[2] ? ethers.parseEther(process.argv[2]) : ethers.parseEther("0.01");
  
  console.log(`💰 Attempting to buy tokens for ${ethers.formatEther(buyAmount)} ETH`);

  // Check current status
  const saleEnded = await dynamicPresale.saleEnded();
  if (saleEnded) {
    console.error("❌ Sale has ended");
    process.exit(1);
  }

  const hasActivePhase = await dynamicPresale.hasActivePhase();
  if (!hasActivePhase) {
    console.error("❌ No active phase available");
    process.exit(1);
  }

  // Check buyer's current contribution
  const currentContribution = await dynamicPresale.contributionsWei(buyer.address);
  const maxPerWallet = await dynamicPresale.maxPerWallet();
  const remainingCapacity = maxPerWallet - currentContribution;
  
  console.log(`Current contribution: ${ethers.formatEther(currentContribution)} ETH`);
  console.log(`Max per wallet: ${ethers.formatEther(maxPerWallet)} ETH`);
  console.log(`Remaining capacity: ${ethers.formatEther(remainingCapacity)} ETH`);

  if (buyAmount > remainingCapacity) {
    console.error(`❌ Buy amount exceeds remaining capacity (${ethers.formatEther(remainingCapacity)} ETH)`);
    process.exit(1);
  }

  // Get current phase info
  const currentPhase = await dynamicPresale.getCurrentPhase();
  const phase = await dynamicPresale.getPhase(currentPhase);
  
  console.log(`\n📅 Current Phase ${currentPhase}:`);
  console.log(`Price: ${ethers.formatEther(phase.priceWei)} ETH per token`);
  console.log(`Available: ${ethers.formatEther(phase.supply - phase.sold)} tokens`);

  // Calculate expected tokens
  const tokenDecimals = await dynamicPresale.tokenDecimals();
  const tokenUnit = 10n ** BigInt(tokenDecimals);
  const expectedTokens = (buyAmount * tokenUnit) / phase.priceWei;
  
  console.log(`Expected tokens: ${ethers.formatEther(expectedTokens)} tokens`);

  // Execute purchase
  console.log("\n🚀 Executing purchase...");
  try {
    const tx = await dynamicPresale.connect(buyer).buy({ value: buyAmount });
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Gas used: ${receipt!.gasUsed}`);
    
    // Check new balances
    const newContribution = await dynamicPresale.contributionsWei(buyer.address);
    const pendingTokens = await dynamicPresale.pendingTokens(buyer.address);
    
    console.log("\n✅ Purchase successful!");
    console.log(`Total contribution: ${ethers.formatEther(newContribution)} ETH`);
    console.log(`Pending tokens: ${ethers.formatEther(pendingTokens)} tokens`);
    
    // Check if soft cap reached
    const softCapReached = await dynamicPresale.softCapReached();
    if (softCapReached) {
      console.log("🎉 Soft cap reached! Tokens can be claimed when sale ends.");
    }
    
  } catch (error: any) {
    console.error("❌ Purchase failed:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });