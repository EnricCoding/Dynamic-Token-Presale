import { ethers } from "hardhat";

async function main() {
  // Get contract addresses from deployment or environment
  const MYTOKEN_ADDRESS = process.env.MYTOKEN_ADDRESS || "";
  const DYNAMICPRESALE_ADDRESS = process.env.DYNAMICPRESALE_ADDRESS || "";
  const TOKENVESTING_ADDRESS = process.env.TOKENVESTING_ADDRESS || "";

  if (!MYTOKEN_ADDRESS || !DYNAMICPRESALE_ADDRESS || !TOKENVESTING_ADDRESS) {
    console.error("❌ Please set contract addresses in environment variables:");
    console.error("MYTOKEN_ADDRESS, DYNAMICPRESALE_ADDRESS, TOKENVESTING_ADDRESS");
    process.exit(1);
  }

  const [owner] = await ethers.getSigners();
  console.log("📊 Checking presale status with account:", owner.address);

  // Get contracts
  const myToken = await ethers.getContractAt("MyToken", MYTOKEN_ADDRESS);
  const dynamicPresale = await ethers.getContractAt("DynamicPresale", DYNAMICPRESALE_ADDRESS);
  const tokenVesting = await ethers.getContractAt("TokenVesting", TOKENVESTING_ADDRESS);

  console.log("\n=== 🪙 TOKEN STATUS ===");
  const tokenName = await myToken.name();
  const tokenSymbol = await myToken.symbol();
  const tokenDecimals = await myToken.decimals();
  const tokenCap = await myToken.cap();
  const tokenSupply = await myToken.totalSupply();
  const isPaused = await myToken.paused();

  console.log(`Name: ${tokenName} (${tokenSymbol})`);
  console.log(`Decimals: ${tokenDecimals}`);
  console.log(`Cap: ${ethers.formatEther(tokenCap)} tokens`);
  console.log(`Current Supply: ${ethers.formatEther(tokenSupply)} tokens`);
  console.log(`Paused: ${isPaused ? "🔴 YES" : "🟢 NO"}`);

  console.log("\n=== 🚀 PRESALE STATUS ===");
  const totalRaised = await dynamicPresale.totalRaised();
  const totalBuyers = await dynamicPresale.totalBuyers();
  const totalTokensSold = await dynamicPresale.totalTokensSold();
  const softCap = await dynamicPresale.softCap();
  const softCapReached = await dynamicPresale.softCapReached();
  const saleEnded = await dynamicPresale.saleEnded();
  const presalePaused = await dynamicPresale.paused();

  console.log(`Total Raised: ${ethers.formatEther(totalRaised)} ETH`);
  console.log(`Soft Cap: ${ethers.formatEther(softCap)} ETH`);
  console.log(`Soft Cap Reached: ${softCapReached ? "🟢 YES" : "🔴 NO"}`);
  console.log(`Total Buyers: ${totalBuyers}`);
  console.log(`Tokens Sold: ${ethers.formatEther(totalTokensSold)} tokens`);
  console.log(`Sale Ended: ${saleEnded ? "🔴 YES" : "🟢 NO"}`);
  console.log(`Presale Paused: ${presalePaused ? "🔴 YES" : "🟢 NO"}`);

  console.log("\n=== 📅 PHASE INFORMATION ===");
  const totalPhases = await dynamicPresale.totalPhases();
  const currentTime = Math.floor(Date.now() / 1000);

  for (let i = 0; i < totalPhases; i++) {
    const phase = await dynamicPresale.getPhase(i);
    const isActive = phase.start <= currentTime && currentTime <= phase.end;
    const isCompleted = currentTime > phase.end;
    const isPending = currentTime < phase.start;
    
    let status = "📅 PENDING";
    if (isActive) status = "🟢 ACTIVE";
    else if (isCompleted) status = "🔴 COMPLETED";
    
    console.log(`\nPhase ${i}:`);
    console.log(`  Status: ${status}`);
    console.log(`  Price: ${ethers.formatEther(phase.priceWei)} ETH per token`);
    console.log(`  Supply: ${ethers.formatEther(phase.supply)} tokens`);
    console.log(`  Sold: ${ethers.formatEther(phase.sold)} tokens (${((Number(phase.sold) / Number(phase.supply)) * 100).toFixed(2)}%)`);
    console.log(`  Start: ${new Date(Number(phase.start) * 1000).toLocaleString()}`);
    console.log(`  End: ${new Date(Number(phase.end) * 1000).toLocaleString()}`);
  }

  console.log("\n=== 🔐 VESTING STATUS ===");
  const vestingTokenBalance = await myToken.balanceOf(TOKENVESTING_ADDRESS);
  console.log(`Vesting Contract Balance: ${ethers.formatEther(vestingTokenBalance)} tokens`);

  // Check if owner has any vesting schedules
  try {
    const ownerSchedules = await tokenVesting.getScheduleCount(owner.address);
    console.log(`Owner Vesting Schedules: ${ownerSchedules}`);
    
    for (let i = 0; i < ownerSchedules; i++) {
      const schedule = await tokenVesting.getSchedule(owner.address, i);
      const releasable = await tokenVesting.getReleasableAmount(owner.address, i);
      
      console.log(`\nSchedule ${i}:`);
      console.log(`  Total Amount: ${ethers.formatEther(schedule.totalAmount)} tokens`);
      console.log(`  Released: ${ethers.formatEther(schedule.released)} tokens`);
      console.log(`  Releasable Now: ${ethers.formatEther(releasable)} tokens`);
      console.log(`  Cliff: ${new Date(Number(schedule.cliff) * 1000).toLocaleString()}`);
      console.log(`  Start: ${new Date(Number(schedule.start) * 1000).toLocaleString()}`);
      console.log(`  Duration: ${Number(schedule.duration) / 86400} days`);
      console.log(`  Revoked: ${schedule.revoked ? "🔴 YES" : "🟢 NO"}`);
    }
  } catch (error) {
    console.log("No vesting schedules found for owner");
  }

  console.log("\n=== 💰 OWNER BALANCES ===");
  const ownerEthBalance = await ethers.provider.getBalance(owner.address);
  const ownerTokenBalance = await myToken.balanceOf(owner.address);
  console.log(`ETH Balance: ${ethers.formatEther(ownerEthBalance)} ETH`);
  console.log(`Token Balance: ${ethers.formatEther(ownerTokenBalance)} tokens`);

  // Check if owner can withdraw proceeds
  if (saleEnded && softCapReached) {
    const contractBalance = await ethers.provider.getBalance(DYNAMICPRESALE_ADDRESS);
    console.log(`Contract ETH Balance: ${ethers.formatEther(contractBalance)} ETH`);
    if (contractBalance > 0) {
      console.log("💡 You can withdraw proceeds using: npm run withdraw-proceeds");
    }
  }

  console.log("\n=== ⚡ QUICK ACTIONS ===");
  console.log("Available scripts:");
  console.log("• npm run status - Show this status");
  console.log("• npm run add-phase - Add new phase");
  console.log("• npm run pause-presale - Pause presale");
  console.log("• npm run unpause-presale - Unpause presale"); 
  console.log("• npm run end-sale - End sale manually");
  console.log("• npm run withdraw-proceeds - Withdraw ETH proceeds");
  console.log("• npm run create-vesting - Create vesting schedule");
  console.log("• npm run buy-tokens - Buy tokens (test)");
  console.log("• npm run verify-contracts - Verify on explorer");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });