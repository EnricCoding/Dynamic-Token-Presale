import { ethers } from "hardhat";

async function main() {
  const DYNAMICPRESALE_ADDRESS = process.env.DYNAMICPRESALE_ADDRESS || "";
  
  if (!DYNAMICPRESALE_ADDRESS) {
    console.error("❌ Please set DYNAMICPRESALE_ADDRESS environment variable");
    process.exit(1);
  }

  const [owner] = await ethers.getSigners();
  console.log("🔧 Managing presale with account:", owner.address);

  const dynamicPresale = await ethers.getContractAt("DynamicPresale", DYNAMICPRESALE_ADDRESS);

  // Get command line arguments
  const action = process.argv[2];
  
  switch (action) {
    case "pause":
      console.log("⏸️ Pausing presale...");
      await dynamicPresale.pause();
      console.log("✅ Presale paused");
      break;
      
    case "unpause":
      console.log("▶️ Unpausing presale...");
      await dynamicPresale.unpause();
      console.log("✅ Presale unpaused");
      break;
      
    case "end":
      console.log("🛑 Ending sale...");
      await dynamicPresale.endSale();
      console.log("✅ Sale ended");
      break;
      
    case "withdraw":
      const recipient = process.argv[3] || owner.address;
      console.log(`💰 Withdrawing proceeds to ${recipient}...`);
      const tx = await dynamicPresale.withdrawProceeds(recipient);
      await tx.wait();
      console.log("✅ Proceeds withdrawn");
      break;
      
    case "add-phase":
      const priceWei = process.argv[3];
      const supply = process.argv[4];
      const start = process.argv[5];
      const duration = process.argv[6];
      
      if (!priceWei || !supply || !start || !duration) {
        console.error("❌ Usage: npm run manage-presale add-phase <priceWei> <supply> <start> <duration>");
        console.error("Example: npm run manage-presale add-phase 1000000000000000 100000000000000000000000 1700000000 3600");
        process.exit(1);
      }
      
      const startTime = parseInt(start);
      const endTime = startTime + parseInt(duration);
      
      console.log("➕ Adding new phase...");
      console.log(`Price: ${ethers.formatEther(priceWei)} ETH per token`);
      console.log(`Supply: ${ethers.formatEther(supply)} tokens`);
      console.log(`Start: ${new Date(startTime * 1000).toLocaleString()}`);
      console.log(`End: ${new Date(endTime * 1000).toLocaleString()}`);
      
      await dynamicPresale.addPhase(priceWei, supply, startTime, endTime);
      console.log("✅ Phase added");
      break;
      
    default:
      console.log("🔧 Presale Management Tool");
      console.log("Available commands:");
      console.log("• npm run manage-presale pause - Pause presale");
      console.log("• npm run manage-presale unpause - Unpause presale");
      console.log("• npm run manage-presale end - End sale");
      console.log("• npm run manage-presale withdraw [recipient] - Withdraw proceeds");
      console.log("• npm run manage-presale add-phase <priceWei> <supply> <start> <duration> - Add phase");
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });