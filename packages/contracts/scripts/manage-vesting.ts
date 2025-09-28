import { ethers } from "hardhat";

async function main() {
  const TOKENVESTING_ADDRESS = process.env.TOKENVESTING_ADDRESS || "";
  
  if (!TOKENVESTING_ADDRESS) {
    console.error("❌ Please set TOKENVESTING_ADDRESS environment variable");
    process.exit(1);
  }

  const [owner] = await ethers.getSigners();
  console.log("👥 Managing token vesting with account:", owner.address);

  const tokenVesting = await ethers.getContractAt("TokenVesting", TOKENVESTING_ADDRESS);

  const action = process.argv[2];
  
  switch (action) {
    case "create":
      const beneficiary = process.argv[3];
      const amount = process.argv[4];
      const start = process.argv[5];
      const duration = process.argv[6];
      const cliff = process.argv[7];
      const revocable = process.argv[8] === "true";
      
      if (!beneficiary || !amount || !start || !duration || !cliff) {
        console.error("❌ Usage: npm run manage-vesting create <beneficiary> <amount> <start> <duration> <cliff> <revocable>");
        console.error("Example: npm run manage-vesting create 0x123... 1000000000000000000000 1700000000 31536000 2592000 true");
        process.exit(1);
      }
      
      const startTime = parseInt(start);
      const durationSec = parseInt(duration);
      const cliffSec = parseInt(cliff);
      
      console.log("📅 Creating vesting schedule...");
      console.log(`Beneficiary: ${beneficiary}`);
      console.log(`Amount: ${ethers.formatEther(amount)} tokens`);
      console.log(`Start: ${new Date(startTime * 1000).toLocaleString()}`);
      console.log(`Duration: ${durationSec / 86400} days`);
      console.log(`Cliff: ${cliffSec / 86400} days`);
      console.log(`Revocable: ${revocable}`);
      
      await tokenVesting.createVesting(
        beneficiary,
        amount,
        startTime,
        durationSec,
        cliffSec,
        revocable
      );
      console.log("✅ Vesting schedule created");
      break;
      
    case "release":
      const scheduleId = process.argv[3] || "0";
      console.log(`🎁 Releasing vesting schedule ${scheduleId}...`);
      await tokenVesting.connect(owner).releaseSchedule(parseInt(scheduleId));
      console.log("✅ Tokens released");
      break;
      
    case "revoke":
      const revokeBeneficiary = process.argv[3];
      const revokeScheduleId = process.argv[4] || "0";
      
      if (!revokeBeneficiary) {
        console.error("❌ Usage: npm run manage-vesting revoke <beneficiary> [scheduleId]");
        process.exit(1);
      }
      
      console.log(`🚫 Revoking vesting schedule ${revokeScheduleId} for ${revokeBeneficiary}...`);
      await tokenVesting.revokeVesting(revokeBeneficiary, parseInt(revokeScheduleId));
      console.log("✅ Vesting schedule revoked");
      break;
      
    case "status":
      const statusBeneficiary = process.argv[3];
      
      if (!statusBeneficiary) {
        console.error("❌ Usage: npm run manage-vesting status <beneficiary>");
        process.exit(1);
      }
      
      console.log(`📊 Vesting status for ${statusBeneficiary}:`);
      
      const scheduleCount = await tokenVesting.getScheduleCount(statusBeneficiary);
      console.log(`Total schedules: ${scheduleCount}`);
      
      for (let i = 0; i < scheduleCount; i++) {
        const schedule = await tokenVesting.getSchedule(statusBeneficiary, i);
        const releasable = await tokenVesting.getReleasableAmount(statusBeneficiary, i);
        const remaining = schedule.totalAmount - schedule.released;
        
        console.log(`\n--- Schedule ${i} ---`);
        console.log(`Total Amount: ${ethers.formatEther(schedule.totalAmount)} tokens`);
        console.log(`Released: ${ethers.formatEther(schedule.released)} tokens`);
        console.log(`Remaining: ${ethers.formatEther(remaining)} tokens`);
        console.log(`Releasable Now: ${ethers.formatEther(releasable)} tokens`);
        console.log(`Start: ${new Date(Number(schedule.start) * 1000).toLocaleString()}`);
        console.log(`Cliff: ${new Date(Number(schedule.cliff) * 1000).toLocaleString()}`);
        console.log(`Duration: ${Number(schedule.duration) / 86400} days`);
        console.log(`Revocable: ${schedule.revocable}`);
        console.log(`Revoked: ${schedule.revoked ? "🔴 YES" : "🟢 NO"}`);
      }
      break;
      
    case "create-team":
      // Quick setup for team member (1 year vesting, 3 months cliff)
      const teamMember = process.argv[3];
      const teamAmount = process.argv[4];
      
      if (!teamMember || !teamAmount) {
        console.error("❌ Usage: npm run manage-vesting create-team <address> <amount>");
        process.exit(1);
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const teamStart = currentTime + 86400; // Start tomorrow
      const teamDuration = 365 * 86400; // 1 year
      const teamCliff = 90 * 86400; // 3 months
      
      console.log("👨‍💼 Creating team member vesting (1 year, 3 months cliff)...");
      await tokenVesting.createVesting(
        teamMember,
        teamAmount,
        teamStart,
        teamDuration,
        teamCliff,
        true // revocable
      );
      console.log("✅ Team vesting created");
      break;
      
    case "create-advisor":
      // Quick setup for advisor (6 months vesting, 1 month cliff)
      const advisor = process.argv[3];
      const advisorAmount = process.argv[4];
      
      if (!advisor || !advisorAmount) {
        console.error("❌ Usage: npm run manage-vesting create-advisor <address> <amount>");
        process.exit(1);
      }
      
      const currentTimeAdvisor = Math.floor(Date.now() / 1000);
      const advisorStart = currentTimeAdvisor + 86400; // Start tomorrow
      const advisorDuration = 180 * 86400; // 6 months
      const advisorCliff = 30 * 86400; // 1 month
      
      console.log("🎯 Creating advisor vesting (6 months, 1 month cliff)...");
      await tokenVesting.createVesting(
        advisor,
        advisorAmount,
        advisorStart,
        advisorDuration,
        advisorCliff,
        false // not revocable
      );
      console.log("✅ Advisor vesting created");
      break;
      
    default:
      console.log("👥 Token Vesting Management Tool");
      console.log("Available commands:");
      console.log("• npm run manage-vesting create <beneficiary> <amount> <start> <duration> <cliff> <revocable>");
      console.log("• npm run manage-vesting create-team <address> <amount> - Quick team setup");
      console.log("• npm run manage-vesting create-advisor <address> <amount> - Quick advisor setup");
      console.log("• npm run manage-vesting release [scheduleId] - Release vested tokens");
      console.log("• npm run manage-vesting revoke <beneficiary> [scheduleId] - Revoke vesting");
      console.log("• npm run manage-vesting status <beneficiary> - Check vesting status");
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });