import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  VestingCreated,
  TokensReleased,
  VestingRevoked
} from "../generated/TokenVesting/TokenVesting";
import {
  User,
  VestingSchedule,
  TokenRelease,
  VestingStats
} from "../generated/schema";

// Helper: Get or create User
function getOrCreateUser(address: Bytes, timestamp: BigInt): User {
  let user = User.load(address.toHexString());
  if (user == null) {
    user = new User(address.toHexString());
    user.totalContributed = BigInt.fromI32(0);
    user.totalTokensPurchased = BigInt.fromI32(0);
    user.totalTokensClaimed = BigInt.fromI32(0);
    user.totalRefunded = BigInt.fromI32(0);
    user.totalVested = BigInt.fromI32(0);
    user.totalReleased = BigInt.fromI32(0);
    user.tokenBalance = BigInt.fromI32(0);
    user.firstInteractionTimestamp = timestamp;
    user.lastInteractionTimestamp = timestamp;
    user.save();
  }
  return user;
}

// Helper: Get or create VestingStats
function getOrCreateVestingStats(): VestingStats {
  let stats = VestingStats.load("1");
  if (stats == null) {
    stats = new VestingStats("1");
    stats.totalSchedules = BigInt.fromI32(0);
    stats.totalCommitted = BigInt.fromI32(0);
    stats.totalReleased = BigInt.fromI32(0);
    stats.totalRevoked = BigInt.fromI32(0);
    stats.lastUpdatedTimestamp = BigInt.fromI32(0);
    stats.save();
  }
  return stats;
}

// Handler: VestingCreated
export function handleVestingCreated(event: VestingCreated): void {
  let user = getOrCreateUser(event.params.beneficiary, event.block.timestamp);
  let stats = getOrCreateVestingStats();
  
  // Create VestingSchedule entity
  let scheduleId = event.params.beneficiary.toHexString() + "-" + event.params.scheduleId.toString();
  let schedule = new VestingSchedule(scheduleId);
  schedule.beneficiary = user.id;
  schedule.scheduleId = event.params.scheduleId;
  schedule.totalAmount = event.params.totalAmount;
  schedule.released = BigInt.fromI32(0);
  schedule.remaining = event.params.totalAmount;
  schedule.startTime = event.params.start;
  schedule.duration = event.params.duration;
  schedule.cliff = event.params.cliff;
  schedule.revocable = event.params.revocable;
  schedule.revoked = false;
  schedule.revokedAt = null;
  schedule.revokedAmount = null;
  schedule.createdAtTimestamp = event.block.timestamp;
  schedule.createdAtBlockNumber = event.block.number;
  schedule.lastReleasedTimestamp = null;
  schedule.save();
  
  // Update user
  user.totalVested = user.totalVested.plus(event.params.totalAmount);
  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();
  
  // Update stats
  stats.totalSchedules = stats.totalSchedules.plus(BigInt.fromI32(1));
  stats.totalCommitted = stats.totalCommitted.plus(event.params.totalAmount);
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

// Handler: TokensReleased
export function handleTokensReleased(event: TokensReleased): void {
  let user = getOrCreateUser(event.params.beneficiary, event.block.timestamp);
  let stats = getOrCreateVestingStats();
  
  // Update VestingSchedule
  let scheduleId = event.params.beneficiary.toHexString() + "-" + event.params.scheduleId.toString();
  let schedule = VestingSchedule.load(scheduleId);
  if (schedule != null) {
    schedule.released = schedule.released.plus(event.params.amount);
    schedule.remaining = schedule.totalAmount.minus(schedule.released);
    schedule.lastReleasedTimestamp = event.block.timestamp;
    schedule.save();
  }
  
  // Create TokenRelease entity
  let releaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let release = new TokenRelease(releaseId);
  release.beneficiary = user.id;
  release.schedule = scheduleId;
  release.amount = event.params.amount;
  release.timestamp = event.block.timestamp;
  release.blockNumber = event.block.number;
  release.transactionHash = event.transaction.hash;
  release.save();
  
  // Update user
  user.totalReleased = user.totalReleased.plus(event.params.amount);
  user.tokenBalance = user.tokenBalance.plus(event.params.amount);
  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();
  
  // Update stats
  stats.totalReleased = stats.totalReleased.plus(event.params.amount);
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}

// Handler: VestingRevoked
export function handleVestingRevoked(event: VestingRevoked): void {
  let user = getOrCreateUser(event.params.beneficiary, event.block.timestamp);
  let stats = getOrCreateVestingStats();
  
  // Update VestingSchedule
  let scheduleId = event.params.beneficiary.toHexString() + "-" + event.params.scheduleId.toString();
  let schedule = VestingSchedule.load(scheduleId);
  if (schedule != null) {
    schedule.revoked = true;
    schedule.revokedAt = event.block.timestamp;
    schedule.revokedAmount = event.params.unvestedAmount;
    schedule.remaining = BigInt.fromI32(0); // All remaining tokens returned
    schedule.save();
  }
  
  // Update user
  user.totalVested = user.totalVested.minus(event.params.unvestedAmount);
  user.lastInteractionTimestamp = event.block.timestamp;
  user.save();
  
  // Update stats
  stats.totalRevoked = stats.totalRevoked.plus(event.params.unvestedAmount);
  stats.totalCommitted = stats.totalCommitted.minus(event.params.unvestedAmount);
  stats.lastUpdatedTimestamp = event.block.timestamp;
  stats.save();
}
